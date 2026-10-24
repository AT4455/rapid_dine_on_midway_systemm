import { prisma } from "../db";
import { config } from "../config";
import { HttpError } from "../http";
import { estimateStopEtaSeconds, pointToRouteProgress, type RouteCoords } from "../geo";
import { planKitchenTiming } from "../kitchen";
import { enforceRateLimit } from "../rate-limit";
import { emitToOrder } from "../realtime/server";
import { createNotification } from "../notifications";
import { getDrivingRoute } from "../routing";
import { toNumber } from "../utils";

const providerEtaCache = new Map<string, number>();

function providerEtaAllowed(journeyId: string) {
  const last = providerEtaCache.get(journeyId) ?? 0;
  if (Date.now() - last < 60_000) return false;
  providerEtaCache.set(journeyId, Date.now());
  return true;
}

export async function recordLocation(params: {
  customerId: string;
  journeyId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  source: "GPS" | "SIMULATED" | "MANUAL";
  recordedAt?: string;
}) {
  enforceRateLimit(`location:${params.journeyId}`, 30, 60_000);

  const journey = await prisma.journey.findFirst({
    where: { id: params.journeyId, customerId: params.customerId },
  });
  if (!journey) throw new HttpError(404, "Journey not found.", "not_found");
  if (journey.status === "COMPLETED" || journey.status === "CANCELLED") {
    throw new HttpError(409, "Location sharing has ended for this journey.", "journey_ended");
  }

  const now = new Date();
  const route = Array.isArray(journey.routeGeometry) ? (journey.routeGeometry as RouteCoords) : [];
  const current = { lat: params.latitude, lng: params.longitude };

  const order = await prisma.order.findFirst({
    where: {
      journeyId: journey.id,
      customerId: params.customerId,
      status: { in: ["ACCEPTED", "PREPARING", "READY"] },
    },
    include: { restaurant: { select: { id: true, name: true, latitude: true, longitude: true } } },
  });

  let etaSeconds: number;
  let source: "provider" | "fallback" | "simulated" = params.source === "SIMULATED" ? "simulated" : "fallback";

  if (order && params.source !== "SIMULATED" && providerEtaAllowed(journey.id)) {
    const routed = await getDrivingRoute(current, {
      lat: toNumber(order.restaurant.latitude),
      lng: toNumber(order.restaurant.longitude),
    });
    if (!routed.isFallback) {
      etaSeconds = routed.durationSeconds;
      source = "provider";
    } else {
      const stopProgress = pointToRouteProgress(route, {
        lat: toNumber(order.restaurant.latitude),
        lng: toNumber(order.restaurant.longitude),
      });
      etaSeconds = estimateStopEtaSeconds(route, journey.routeDurationSeconds, current, stopProgress);
    }
  } else if (order) {
    const stopProgress = pointToRouteProgress(route, {
      lat: toNumber(order.restaurant.latitude),
      lng: toNumber(order.restaurant.longitude),
    });
    etaSeconds = estimateStopEtaSeconds(route, journey.routeDurationSeconds, current, stopProgress);
  } else {
    // No accepted order yet: keep a live ETA to the destination.
    const progress = pointToRouteProgress(route, current);
    etaSeconds = Math.max(60, Math.round(journey.routeDurationSeconds * Math.max(0, 1 - progress)));
  }

  const etaAt = new Date(now.getTime() + etaSeconds * 1000);

  const location = await prisma.$transaction(async (tx) => {
    const created = await tx.locationUpdate.create({
      data: {
        journeyId: journey.id,
        customerId: params.customerId,
        latitude: params.latitude,
        longitude: params.longitude,
        accuracyMeters: params.accuracyMeters,
        etaSeconds,
        source: params.source,
        recordedAt: params.recordedAt ? new Date(params.recordedAt) : now,
      },
    });
    await tx.journey.update({
      where: { id: journey.id },
      data: {
        lastLocationAt: now,
        lastEtaAt: now,
        lastEtaSeconds: etaSeconds,
        status: journey.status === "PLANNED" ? "ACTIVE" : journey.status,
        startedAt: journey.startedAt ?? now,
      },
    });
    if (order) {
      const timing = planKitchenTiming({
        etaAt,
        prepTimeMinutes: order.prepTimeMinutes,
        now,
        etaUpdatedAt: now,
      });
      const alreadyCooking = Boolean(order.cookNotifiedAt);
      await tx.order.update({
        where: { id: order.id },
        data: {
          estimatedReadyAt: etaAt,
          etaUpdatedAt: now,
          kitchenWarning: alreadyCooking && timing.tooSoon
            ? "Traveller is running late. Hold ready food warm and confirm pickup."
            : timing.warning,
          ...(alreadyCooking ? {} : { cookingStartAt: timing.cookingStartAt }),
        },
      });
    }
    return created;
  });

  // Privacy: precise history is short-lived. Delete old points opportunistically.
  if (Math.random() < 0.1) {
    const cutoff = new Date(now.getTime() - config.location.retentionHours * 3600_000);
    await prisma.locationUpdate
      .deleteMany({ where: { journeyId: journey.id, recordedAt: { lt: cutoff } } })
      .catch(() => undefined);
  }

  if (order) {
    const payload = {
      orderId: order.id,
      journeyId: journey.id,
      etaMinutes: Math.max(1, Math.round(etaSeconds / 60)),
      etaAt: etaAt.toISOString(),
      source,
      recordedAt: now.toISOString(),
    };
    emitToOrder(order.id, "customer:etaUpdated", payload, {
      customerId: params.customerId,
      restaurantId: order.restaurantId,
    });
    if (params.source === "GPS") {
      await createNotification({
        userId: params.customerId,
        type: "ETA_UPDATE",
        title: "Pickup ETA refreshed",
        body: `${order.restaurant.name} should have your food ready in about ${payload.etaMinutes} min.`,
        orderId: order.id,
        data: { orderId: order.id, etaMinutes: payload.etaMinutes },
        dedupeKey: `eta-customer:${order.id}:${Math.floor(now.getTime() / 600_000)}`,
      }).catch(() => undefined);
    }
  }

  return {
    locationId: location.id,
    etaSeconds,
    etaAt,
    etaMinutes: Math.max(1, Math.round(etaSeconds / 60)),
    source,
    simulated: params.source === "SIMULATED",
    staleAt: new Date(now.getTime() + config.location.staleAfterMinutes * 60000),
  };
}

export async function stopTracking(customerId: string, journeyId: string) {
  const journey = await prisma.journey.findFirst({ where: { id: journeyId, customerId } });
  if (!journey) throw new HttpError(404, "Journey not found.", "not_found");
  await prisma.$transaction([
    prisma.journey.update({
      where: { id: journey.id },
      data: { status: "COMPLETED", endedAt: new Date() },
    }),
    // Stop location sharing: remove stored precise points for the journey.
    prisma.locationUpdate.deleteMany({ where: { journeyId: journey.id } }),
  ]);
  return { stopped: true };
}

export async function latestLocationForRestaurant(restaurantId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    select: { journeyId: true, customerId: true },
  });
  if (!order?.journeyId) return null;
  return prisma.locationUpdate.findFirst({
    where: { journeyId: order.journeyId },
    orderBy: { recordedAt: "desc" },
  });
}
