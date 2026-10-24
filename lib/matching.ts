import type { Prisma } from "@prisma/client";
import { config } from "./config";
import { prisma } from "./db";
import { filterStopsByCorridor, type RouteCoords } from "./geo";
import { calculatePrepMinutes } from "./kitchen";
import { isRestaurantOpen } from "./restaurants";
import { money, toNumber } from "./utils";

export type RequestedDish = {
  dishName: string;
  quantity: number;
};

export type EligibleRestaurant = {
  id: string;
  name: string;
  slug: string;
  cuisine: string;
  imageUrl: string | null;
  address: string;
  rating: number;
  ratingCount: number;
  latitude: number;
  longitude: number;
  distanceFromRouteMeters: number;
  detourMeters: number;
  routeProgress: number;
  etaSeconds: number;
  etaMinutes: number;
  total: number;
  fees: number;
  prepTimeMinutes: number;
  isPreferred: boolean;
  openNow: boolean;
  activeOrders: number;
  capacityPerHour: number;
  items: Array<{
    menuItemId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    prepTimeMinutes: number;
    dietaryTags: string[];
  }>;
};

export function normalizeDishName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function feesForSubtotal(subtotal: number) {
  const rate = money(subtotal * config.bounty.serviceFeeRate);
  return money(rate + config.bounty.platformFee);
}

export function orderTotals(subtotal: number) {
  const fees = feesForSubtotal(subtotal);
  return { subtotal: money(subtotal), fees, total: money(subtotal + fees) };
}

type RestaurantCandidate = Prisma.RestaurantGetPayload<{
  include: {
    menuItems: true;
    orders: { select: { id: true } };
    memberships: { select: { userId: true } };
  };
}>;

export type EvaluationResult =
  | { eligible: true; offer: EligibleRestaurant }
  | { eligible: false; reason: string };

export function evaluateRestaurant(
  restaurant: RestaurantCandidate,
  requested: RequestedDish[],
  budget: number,
  corridor: {
    distanceFromRouteMeters: number;
    detourMeters: number;
    routeProgress: number;
  },
  routeDurationSeconds: number,
  now: Date,
  preferredRestaurantId?: string | null,
): EvaluationResult {
  if (!restaurant.isActive) return { eligible: false, reason: "Restaurant is inactive" };
  if (restaurant.verificationStatus !== "VERIFIED") {
    return { eligible: false, reason: "Restaurant is not verified" };
  }
  if (!isRestaurantOpen(restaurant, now)) {
    return { eligible: false, reason: "Restaurant is closed right now" };
  }
  if (restaurant.orders.length >= restaurant.capacityPerHour) {
    return { eligible: false, reason: "Kitchen is at capacity" };
  }

  const menuByName = new Map(
    restaurant.menuItems
      .filter((item) => item.isAvailable && !item.isArchived)
      .map((item) => [normalizeDishName(item.name), item]),
  );

  const matchedItems: EligibleRestaurant["items"] = [];
  let subtotal = 0;
  for (const dish of requested) {
    const menuItem = menuByName.get(normalizeDishName(dish.dishName));
    if (!menuItem) return { eligible: false, reason: `No available “${dish.dishName}” on the menu` };
    const unitPrice = toNumber(menuItem.price);
    subtotal += unitPrice * dish.quantity;
    matchedItems.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      unitPrice,
      quantity: dish.quantity,
      prepTimeMinutes: menuItem.prepTimeMinutes,
      dietaryTags: Array.isArray(menuItem.dietaryTags)
        ? (menuItem.dietaryTags as string[])
        : [],
    });
  }

  const totals = orderTotals(subtotal);
  if (totals.total > budget + 0.001) {
    return { eligible: false, reason: "Dish prices plus fees exceed the traveller's budget" };
  }

  const prepTimeMinutes = calculatePrepMinutes(
    matchedItems.map((i) => ({ prepTimeMinutes: i.prepTimeMinutes, quantity: i.quantity })),
  );
  const etaSeconds = Math.max(120, Math.round(routeDurationSeconds * Math.max(0.02, 1 - corridor.routeProgress)));

  return {
    eligible: true,
    offer: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      cuisine: restaurant.cuisine,
      imageUrl: restaurant.imageUrl,
      address: restaurant.address,
      rating: toNumber(restaurant.rating),
      ratingCount: restaurant.ratingCount,
      latitude: toNumber(restaurant.latitude),
      longitude: toNumber(restaurant.longitude),
      distanceFromRouteMeters: corridor.distanceFromRouteMeters,
      detourMeters: corridor.detourMeters,
      routeProgress: corridor.routeProgress,
      etaSeconds,
      etaMinutes: Math.max(2, Math.round(etaSeconds / 60)),
      total: totals.total,
      fees: totals.fees,
      prepTimeMinutes,
      isPreferred: preferredRestaurantId === restaurant.id,
      openNow: true,
      activeOrders: restaurant.orders.length,
      capacityPerHour: restaurant.capacityPerHour,
      items: matchedItems,
    },
  };
}

export async function findEligibleRestaurants(params: {
  journey: {
    routeGeometry: unknown;
    routeDurationSeconds: number;
    corridorMeters: number;
  };
  requested: RequestedDish[];
  budget: number;
  preferredRestaurantId?: string | null;
  now?: Date;
}): Promise<{ eligible: EligibleRestaurant[]; considered: number; reasons: string[] }> {
  const now = params.now ?? new Date();
  const route = Array.isArray(params.journey.routeGeometry)
    ? (params.journey.routeGeometry as RouteCoords)
    : [];

  const candidates = await prisma.restaurant.findMany({
    where: { isActive: true, verificationStatus: "VERIFIED" },
    include: {
      menuItems: true,
      orders: {
        where: { status: { in: ["ACCEPTED", "PREPARING", "READY"] } },
        select: { id: true },
      },
      memberships: { select: { userId: true } },
    },
  });

  const corridorMatches = filterStopsByCorridor(
    candidates.map((r) => ({
      id: r.id,
      latitude: r.latitude,
      longitude: r.longitude,
    })),
    route,
    params.journey.corridorMeters,
  );
  const corridorById = new Map(corridorMatches.map((m) => [m.id, m]));

  const eligible: EligibleRestaurant[] = [];
  const reasons: string[] = [];

  for (const restaurant of candidates) {
    const corridor = corridorById.get(restaurant.id);
    if (!corridor) {
      continue; // outside the customer's corridor
    }
    const result = evaluateRestaurant(
      restaurant,
      params.requested,
      params.budget,
      corridor,
      params.journey.routeDurationSeconds,
      now,
      params.preferredRestaurantId,
    );
    if (result.eligible) {
      eligible.push(result.offer);
    } else if (restaurant.id === params.preferredRestaurantId) {
      reasons.push(`${restaurant.name}: ${result.reason}`);
    }
  }

  eligible.sort((a, b) => {
    if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
    if (Math.abs(a.distanceFromRouteMeters - b.distanceFromRouteMeters) > 500) {
      return a.distanceFromRouteMeters - b.distanceFromRouteMeters;
    }
    return a.total - b.total;
  });

  return { eligible, considered: candidates.length, reasons };
}

/** Re-evaluates one restaurant at acceptance time (defence against stale offers). */
export async function revalidateRestaurantOffer(params: {
  restaurantId: string;
  requested: RequestedDish[];
  budget: number;
  journey: {
    routeGeometry: unknown;
    routeDurationSeconds: number;
    corridorMeters: number;
  };
  preferredRestaurantId?: string | null;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const restaurant = await prisma.restaurant.findUnique({
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
  if (!restaurant) return { eligible: false as const, reason: "Restaurant not found" };

  const route = Array.isArray(params.journey.routeGeometry)
    ? (params.journey.routeGeometry as RouteCoords)
    : [];
  const matches = filterStopsByCorridor(
    [{ id: restaurant.id, latitude: restaurant.latitude, longitude: restaurant.longitude }],
    route,
    params.journey.corridorMeters,
  );
  if (!matches.length) return { eligible: false as const, reason: "Restaurant is outside the journey corridor" };

  return evaluateRestaurant(
    restaurant,
    params.requested,
    params.budget,
    matches[0],
    params.journey.routeDurationSeconds,
    now,
    params.preferredRestaurantId,
  );
}
