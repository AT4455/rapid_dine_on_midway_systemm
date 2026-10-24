import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../http";
import { planKitchenTiming } from "../kitchen";
import {
  evaluateRestaurant,
  feesForSubtotal,
  findEligibleRestaurants,
  type EligibleRestaurant,
  type RequestedDish,
} from "../matching";
import { pointToRouteProgress, type RouteCoords } from "../geo";
import { notifyRestaurantMembers, createNotification } from "../notifications";
import { emitToBounty, emitToOrder, emitToRestaurant, emitToUser } from "../realtime/server";
import { money, toNumber } from "../utils";
import { config } from "../config";
import type { BountyCreateInput } from "../validation";

function orderNumber() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RD-${stamp}-${rand}`;
}

export async function createBounty(customerId: string, input: BountyCreateInput) {
  const journey = await prisma.journey.findFirst({
    where: { id: input.journeyId, customerId },
  });
  if (!journey) throw new HttpError(404, "Journey not found.", "journey_not_found");
  if (journey.status === "COMPLETED" || journey.status === "CANCELLED") {
    throw new HttpError(409, "This journey has ended. Plan a new journey to order.", "journey_ended");
  }

  const existing = await prisma.bounty.findFirst({
    where: { journeyId: journey.id, customerId, status: { in: ["OPEN", "ACCEPTED"] } },
    select: { id: true },
  });
  if (existing) {
    throw new HttpError(409, "You already have an active bounty for this journey.", "bounty_exists");
  }

  // Consolidate duplicate cart lines and load authoritative menu data.
  const grouped = new Map<string, number>();
  for (const item of input.items) {
    grouped.set(item.menuItemId, (grouped.get(item.menuItemId) ?? 0) + item.quantity);
  }
  for (const [id, qty] of grouped) {
    if (qty > config.bounty.maxQuantityPerItem) {
      throw new HttpError(422, "Maximum quantity per dish is 10.", "invalid_quantity", { menuItemId: id });
    }
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: [...grouped.keys()] } },
  });
  if (menuItems.length !== grouped.size) {
    throw new HttpError(422, "One or more dishes are no longer available.", "item_unavailable");
  }
  for (const item of menuItems) {
    if (!item.isAvailable || item.isArchived) {
      throw new HttpError(422, `${item.name} is currently unavailable.`, "item_unavailable");
    }
    if (input.preferredRestaurantId && item.restaurantId !== input.preferredRestaurantId) {
      throw new HttpError(422, "Cart items must come from one restaurant.", "cross_restaurant_cart");
    }
  }

  const requested: RequestedDish[] = menuItems.map((item) => ({
    dishName: item.name,
    quantity: grouped.get(item.id) ?? 1,
  }));
  const referenceSubtotal = menuItems.reduce(
    (sum, item) => sum + toNumber(item.price) * (grouped.get(item.id) ?? 1),
    0,
  );
  const referenceTotal = money(referenceSubtotal + feesForSubtotal(referenceSubtotal));
  if (referenceTotal > input.budget + 0.001) {
    throw new HttpError(
      422,
      `Your budget needs to be at least ${referenceTotal.toFixed(0)} to cover these dishes and fees.`,
      "budget_too_low",
      { minimumBudget: referenceTotal },
    );
  }

  const preferred = input.preferredRestaurantId
    ? await prisma.restaurant.findUnique({ where: { id: input.preferredRestaurantId } })
    : null;
  if (input.preferredRestaurantId && !preferred) {
    throw new HttpError(404, "Preferred restaurant not found.", "restaurant_not_found");
  }

  const { eligible, reasons } = await findEligibleRestaurants({
    journey,
    requested,
    budget: input.budget,
    preferredRestaurantId: input.preferredRestaurantId,
  });
  if (!eligible.length) {
    throw new HttpError(
      422,
      reasons[0] ??
        "No verified restaurant along your corridor can prepare this order within your budget right now. Try a wider corridor or a different restaurant.",
      "no_eligible_restaurants",
      { reasons },
    );
  }

  const preferredOffer = eligible.find((r) => r.isPreferred);
  const etaMinutes = preferredOffer?.etaMinutes ?? Math.min(...eligible.map((r) => r.etaMinutes));
  const now = new Date();
  const estimatedArrivalAt = new Date(now.getTime() + etaMinutes * 60000);
  const expiresAt = new Date(now.getTime() + config.bounty.ttlMinutes * 60000);

  const bounty = await prisma.bounty.create({
    data: {
      customerId,
      journeyId: journey.id,
      preferredRestaurantId: input.preferredRestaurantId,
      budget: input.budget,
      note: input.note,
      pickupEtaMinutes: etaMinutes,
      estimatedArrivalAt,
      expiresAt,
      items: {
        create: menuItems.map((item) => ({
          menuItemId: item.id,
          dishName: item.name,
          quantity: grouped.get(item.id) ?? 1,
          referenceUnitPrice: item.price,
        })),
      },
      offers: {
        create: eligible.map((r) => ({
          restaurantId: r.id,
          isPreferred: r.isPreferred,
          distanceFromRouteMeters: r.distanceFromRouteMeters,
          detourMeters: r.detourMeters,
          matchedTotal: r.total,
        })),
      },
    },
    include: {
      items: true,
      offers: true,
      journey: true,
      preferredRestaurant: { select: { id: true, name: true } },
    },
  });

  // Publish only to eligible restaurants. One notification per staff member.
  await Promise.all(
    eligible.map(async (restaurant) => {
      emitToRestaurant(restaurant.id, "bounty:created", {
        bountyId: bounty.id,
        restaurantId: restaurant.id,
        budget: input.budget,
        itemCount: requested.reduce((sum, i) => sum + i.quantity, 0),
        etaMinutes,
      });
      await notifyRestaurantMembers(restaurant.id, {
        type: "BOUNTY_CREATED",
        title: "New bounty on your route",
        body: `${requested.length} dish${requested.length === 1 ? "" : "es"} · budget ₹${input.budget.toFixed(0)} · traveller arriving in ${etaMinutes} min`,
        bountyId: bounty.id,
        data: { bountyId: bounty.id, etaMinutes },
        dedupeKey: `bounty-new:${bounty.id}:${restaurant.id}`,
      });
    }),
  );

  await createNotification({
    userId: customerId,
    type: "SYSTEM",
    title: "Bounty sent to kitchens",
    body: `Your request is live with ${eligible.length} eligible kitchen${eligible.length === 1 ? "" : "s"} along your route.`,
    bountyId: bounty.id,
    data: { bountyId: bounty.id, eligible: eligible.length },
    dedupeKey: `bounty-customer:${bounty.id}`,
  });

  return {
    bounty,
    eligibleCount: eligible.length,
    preferredEligible: Boolean(preferredOffer),
    reasons,
  };
}

export async function acceptBounty(params: {
  bountyId: string;
  restaurantId: string;
  userId: string;
}) {
  let accepted: Awaited<ReturnType<typeof createOrderFromBounty>> | null = null;
  try {
    accepted = await prisma.$transaction(async (tx) => {
      const bounty = await tx.bounty.findUnique({
        where: { id: params.bountyId },
        include: {
          items: true,
          journey: true,
          offers: { where: { restaurantId: params.restaurantId } },
          preferredRestaurant: true,
        },
      });
      if (!bounty) throw new HttpError(404, "Bounty not found.", "not_found");
      if (bounty.status !== "OPEN") {
        throw new HttpError(409, "Another kitchen has already accepted this bounty.", "bounty_taken");
      }
      if (bounty.expiresAt.getTime() < Date.now()) {
        throw new HttpError(409, "This bounty has expired.", "bounty_expired");
      }
      const offer = bounty.offers[0];
      if (!offer || offer.status !== "PENDING") {
        throw new HttpError(403, "This bounty was not offered to your restaurant.", "not_offered");
      }

      const restaurant = await tx.restaurant.findUnique({
        where: { id: params.restaurantId },
        include: {
          menuItems: true,
          orders: {
            where: { status: { in: ["ACCEPTED", "PREPARING", "READY"] } },
            select: { id: true },
          },
          memberships: { select: { userId: true } },
        },
      });
      if (!restaurant) throw new HttpError(404, "Restaurant not found.", "not_found");

      // Full re-validation using the same evaluator as discovery. This catches
      // closed kitchens, sold-out dishes, capacity changes, and budget drift.
      const route = Array.isArray(bounty.journey.routeGeometry)
        ? (bounty.journey.routeGeometry as RouteCoords)
        : [];
      const revalidated = evaluateRestaurant(
        restaurant,
        bounty.items.map((i) => ({ dishName: i.dishName, quantity: i.quantity })),
        toNumber(bounty.budget),
        {
          distanceFromRouteMeters: offer.distanceFromRouteMeters,
          detourMeters: offer.detourMeters,
          routeProgress: pointToRouteProgress(route, {
            lat: toNumber(restaurant.latitude),
            lng: toNumber(restaurant.longitude),
          }),
        },
        bounty.journey.routeDurationSeconds,
        new Date(),
        bounty.preferredRestaurantId,
      );
      if (!revalidated.eligible) {
        await tx.bountyOffer.update({
          where: { id: offer.id },
          data: {
            status: "REJECTED",
            rejectionReason: `Auto-rejected at acceptance: ${revalidated.reason}`,
            respondedAt: new Date(),
          },
        });
        throw new HttpError(409, `Cannot accept: ${revalidated.reason}.`, "offer_no_longer_valid");
      }

      // Atomic claim. Only one restaurant can flip OPEN → ACCEPTED.
      const claimed = await tx.bounty.updateMany({
        where: { id: bounty.id, status: "OPEN" },
        data: {
          status: "ACCEPTED",
          acceptedRestaurantId: params.restaurantId,
          acceptedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new HttpError(409, "Another kitchen just accepted this bounty.", "bounty_taken");
      }

      await tx.bountyOffer.update({
        where: { id: offer.id },
        data: { status: "ACCEPTED", respondedAt: new Date(), matchedTotal: revalidated.offer.total },
      });
      await tx.bountyOffer.updateMany({
        where: { bountyId: bounty.id, id: { not: offer.id }, status: "PENDING" },
        data: { status: "REJECTED", respondedAt: new Date(), rejectionReason: "Another kitchen accepted first" },
      });

      return createOrderFromBounty(tx, {
        bounty,
        restaurant,
        offer: revalidated.offer,
        userId: params.userId,
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "Another kitchen just accepted this bounty.", "bounty_taken");
    }
    throw error;
  }

  if (!accepted) throw new HttpError(500, "Order could not be created.", "order_failed");

  emitToBounty(accepted.bountyId, "bounty:accepted", {
    bountyId: accepted.bountyId,
    orderId: accepted.id,
    restaurantId: accepted.restaurantId,
    restaurantName: accepted.restaurant.name,
  });
  emitToOrder(
    accepted.id,
    "order:statusUpdated",
    { orderId: accepted.id, status: accepted.status, at: new Date().toISOString() },
    { customerId: accepted.customerId, restaurantId: accepted.restaurantId },
  );
  emitToUser(accepted.customerId, "bounty:accepted", {
    bountyId: accepted.bountyId,
    orderId: accepted.id,
    restaurantId: accepted.restaurantId,
    restaurantName: accepted.restaurant.name,
  });

  await createNotification({
    userId: accepted.customerId,
    type: "BOUNTY_ACCEPTED",
    title: `${accepted.restaurant.name} accepted your bounty`,
    body: `Order ${accepted.orderNumber} is confirmed. Estimated arrival ${accepted.estimatedReadyAt ? accepted.estimatedReadyAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "soon"}.`,
    orderId: accepted.id,
    bountyId: accepted.bountyId,
    data: { orderId: accepted.id },
    dedupeKey: `bounty-accepted:${accepted.id}`,
  });

  return accepted;
}

type Tx = Prisma.TransactionClient;

async function createOrderFromBounty(
  tx: Tx,
  params: {
    bounty: Prisma.BountyGetPayload<{ include: { items: true; journey: true } }>;
    restaurant: Prisma.RestaurantGetPayload<{
      include: {
        menuItems: true;
        orders: { select: { id: true } };
        memberships: { select: { userId: true } };
      };
    }>;
    offer: EligibleRestaurant;
    userId: string;
  },
) {
  const offer = params.offer;
  const subtotal = money(offer.total - offer.fees);
  const now = new Date();
  const bountyEta =
    params.bounty.estimatedArrivalAt && params.bounty.estimatedArrivalAt.getTime() > now.getTime() + 60_000
      ? params.bounty.estimatedArrivalAt
      : new Date(now.getTime() + Math.max(5, params.bounty.pickupEtaMinutes) * 60000);
  const timing = planKitchenTiming({
    etaAt: bountyEta,
    prepTimeMinutes: offer.prepTimeMinutes,
    now,
    etaUpdatedAt: now,
  });

  const order = await tx.order.create({
    data: {
      orderNumber: orderNumber(),
      bountyId: params.bounty.id,
      customerId: params.bounty.customerId,
      restaurantId: params.restaurant.id,
      journeyId: params.bounty.journeyId,
      status: "ACCEPTED",
      subtotal,
      fees: offer.fees,
      total: offer.total,
      currency: params.bounty.currency,
      prepTimeMinutes: offer.prepTimeMinutes,
      pickupInstructions: params.restaurant.pickupInstructions,
      customerNote: params.bounty.note,
      estimatedReadyAt: bountyEta,
      etaUpdatedAt: now,
      cookingStartAt: timing.cookingStartAt,
      kitchenWarning: timing.warning,
      acceptedAt: now,
      items: {
        create: offer.items.map((item) => ({
          menuItemId: item.menuItemId,
          nameSnapshot: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          prepTimeMinutes: item.prepTimeMinutes,
          lineTotal: money(item.unitPrice * item.quantity),
          dietaryTags: item.dietaryTags,
        })),
      },
      statusHistory: {
        create: { fromStatus: null, toStatus: "ACCEPTED", actorId: params.userId, actorRole: "RESTAURANT", note: "Bounty accepted" },
      },
    },
    include: { restaurant: { select: { id: true, name: true } }, items: true },
  });

  return {
    ...order,
    bountyId: params.bounty.id,
    customerId: params.bounty.customerId,
    restaurantId: params.restaurant.id,
    restaurant: { id: params.restaurant.id, name: params.restaurant.name },
  };
}

export async function rejectBounty(params: {
  bountyId: string;
  restaurantId: string;
  userId: string;
  reason: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const bounty = await tx.bounty.findUnique({
      where: { id: params.bountyId },
      include: { offers: { where: { restaurantId: params.restaurantId } }, items: true },
    });
    if (!bounty) throw new HttpError(404, "Bounty not found.", "not_found");
    if (bounty.status !== "OPEN") throw new HttpError(409, "This bounty is no longer open.", "not_open");
    const offer = bounty.offers[0];
    if (!offer || offer.status !== "PENDING") {
      throw new HttpError(403, "No pending offer for your restaurant.", "not_offered");
    }
    await tx.bountyOffer.update({
      where: { id: offer.id },
      data: { status: "REJECTED", rejectionReason: params.reason, respondedAt: new Date() },
    });
    const remaining = await tx.bountyOffer.count({
      where: { bountyId: bounty.id, status: "PENDING" },
    });
    if (remaining === 0) {
      await tx.bounty.update({
        where: { id: bounty.id },
        data: { status: "REJECTED", rejectedAt: new Date() },
      });
    }
    return { bounty, remaining };
  });

  emitToUser(result.bounty.customerId, "bounty:rejected", {
    bountyId: result.bounty.id,
    restaurantId: params.restaurantId,
    reason: params.reason,
  });

  if (result.remaining === 0) {
    await createNotification({
      userId: result.bounty.customerId,
      type: "BOUNTY_REJECTED",
      title: "No kitchen could take this bounty",
      body: "Every eligible kitchen passed on this request. Try a wider route corridor or a different pickup restaurant.",
      bountyId: result.bounty.id,
      dedupeKey: `bounty-rejected:${result.bounty.id}`,
    });
  }

  return { rejected: true, remainingOffers: result.remaining };
}

export async function cancelBounty(customerId: string, bountyId: string) {
  const bounty = await prisma.bounty.findFirst({ where: { id: bountyId, customerId } });
  if (!bounty) throw new HttpError(404, "Bounty not found.", "not_found");
  if (bounty.status !== "OPEN") {
    throw new HttpError(409, "Only open bounties can be cancelled.", "not_open");
  }
  await prisma.$transaction([
    prisma.bounty.update({ where: { id: bounty.id }, data: { status: "CANCELLED" } }),
    prisma.bountyOffer.updateMany({
      where: { bountyId: bounty.id, status: "PENDING" },
      data: { status: "CANCELLED", respondedAt: new Date() },
    }),
  ]);
  return { cancelled: true };
}

export async function expireStaleBounties() {
  const now = new Date();
  const stale = await prisma.bounty.findMany({
    where: { status: "OPEN", expiresAt: { lt: now } },
    select: { id: true, customerId: true },
    take: 50,
  });
  if (!stale.length) return 0;
  await prisma.$transaction([
    prisma.bounty.updateMany({
      where: { id: { in: stale.map((b) => b.id) }, status: "OPEN" },
      data: { status: "EXPIRED" },
    }),
    prisma.bountyOffer.updateMany({
      where: { bountyId: { in: stale.map((b) => b.id) }, status: "PENDING" },
      data: { status: "EXPIRED", respondedAt: now },
    }),
  ]);
  await Promise.all(
    stale.map((b) =>
      createNotification({
        userId: b.customerId,
        type: "BOUNTY_REJECTED",
        title: "Bounty expired",
        body: "No kitchen accepted in time. Plan again with a wider corridor or a different budget.",
        bountyId: b.id,
        dedupeKey: `bounty-expired:${b.id}`,
      }),
    ),
  );
  return stale.length;
}
