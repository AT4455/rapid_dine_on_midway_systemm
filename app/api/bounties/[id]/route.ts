import { prisma } from "@/lib/db";
import { getRestaurantContext, requireApiUser } from "@/lib/auth/guards";
import { handleApiError, HttpError, jsonOk } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const bounty = await prisma.bounty.findUnique({
      where: { id },
      include: {
        items: true,
        customer: { select: { id: true, name: true } },
        acceptedRestaurant: {
          select: { id: true, name: true, cuisine: true, imageUrl: true, address: true, phone: true, pickupInstructions: true },
        },
        preferredRestaurant: { select: { id: true, name: true } },
        offers: { select: { restaurantId: true, status: true, isPreferred: true } },
        journey: {
          select: {
            id: true,
            startLabel: true,
            endLabel: true,
            startLatitude: true,
            startLongitude: true,
            endLatitude: true,
            endLongitude: true,
            routeGeometry: true,
            routeDistanceMeters: true,
            routeDurationSeconds: true,
            corridorMeters: true,
            lastEtaAt: true,
            lastEtaSeconds: true,
            lastLocationAt: true,
            status: true,
          },
        },
        order: { select: { id: true, orderNumber: true, status: true, total: true, estimatedReadyAt: true } },
      },
    });
    if (!bounty) throw new HttpError(404, "Bounty not found.", "not_found");

    if (user.role === "CUSTOMER") {
      if (bounty.customerId !== user.id) throw new HttpError(403, "You cannot access this bounty.", "forbidden");
      return jsonOk({ bounty, viewer: "customer" });
    }

    const restaurant = await getRestaurantContext(user.id);
    const offer = restaurant
      ? bounty.offers.find((o) => o.restaurantId === restaurant.restaurant.id)
      : undefined;
    if (!restaurant || !offer) throw new HttpError(403, "This bounty was not offered to you.", "forbidden");

    // Before acceptance, expose the route and ETA only — never precise live
    // coordinates. Live coordinates are available through the order endpoint
    // after this restaurant wins the bounty.
    const acceptedByYou = bounty.acceptedRestaurantId === restaurant.restaurant.id;
    return jsonOk({
      bounty: {
        ...bounty,
        customer: { id: acceptedByYou ? bounty.customer.id : "hidden", name: bounty.customer.name.split(" ")[0] },
        journey: {
          ...bounty.journey,
          ...(acceptedByYou
            ? {}
            : { routeGeometry: bounty.journey.routeGeometry, lastLocationAt: bounty.journey.lastLocationAt }),
        },
      },
      viewer: "restaurant",
      offerStatus: offer.status,
      acceptedByYou,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
