import { prisma } from "@/lib/db";
import { requireApiCustomer } from "@/lib/auth/guards";
import { assertSameOrigin, clientIp, handleApiError, jsonOk, readJson } from "@/lib/http";
import { journeyCreateSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getDrivingRoute } from "@/lib/routing";
import { discoverRestaurants } from "@/lib/services/discovery";
import { HttpError } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireApiCustomer();
    const journeys = await prisma.journey.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        bounties: {
          where: { status: { in: ["OPEN", "ACCEPTED"] } },
          select: { id: true, status: true, acceptedRestaurantId: true },
          take: 1,
        },
        orders: {
          where: { status: { in: ["ACCEPTED", "PREPARING", "READY"] } },
          select: { id: true, status: true, orderNumber: true },
          take: 1,
        },
      },
    });
    return jsonOk({ journeys });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiCustomer();
    enforceRateLimit(`journey:${user.id}`, 12, 10 * 60_000);
    enforceRateLimit(`journey-ip:${clientIp(request)}`, 25, 10 * 60_000);
    const body = journeyCreateSchema.parse(await readJson(request));

    if (body.startLat === body.endLat && body.startLng === body.endLng) {
      throw new HttpError(422, "Start and destination must be different places.", "same_place");
    }

    const route = await getDrivingRoute(
      { lat: body.startLat, lng: body.startLng },
      { lat: body.endLat, lng: body.endLng },
    );

    const journey = await prisma.journey.create({
      data: {
        customerId: user.id,
        startLabel: body.startLabel,
        startLatitude: body.startLat,
        startLongitude: body.startLng,
        endLabel: body.endLabel,
        endLatitude: body.endLat,
        endLongitude: body.endLng,
        routeGeometry: route.geometry,
        routeDistanceMeters: route.distanceMeters,
        routeDurationSeconds: route.durationSeconds,
        corridorMeters: body.corridorMeters,
        provider: route.provider,
        isFallback: route.isFallback,
        status: body.startTracking ? "ACTIVE" : "PLANNED",
        startedAt: body.startTracking ? new Date() : null,
      },
    });

    const restaurants = await discoverRestaurants(journey);

    return jsonOk(
      {
        journey,
        route: {
          provider: route.provider,
          isFallback: route.isFallback,
          warning: route.warning ?? null,
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
        },
        restaurants,
        eligibleCount: restaurants.filter((r) => r.openNow && r.activeOrders < r.capacityPerHour).length,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
