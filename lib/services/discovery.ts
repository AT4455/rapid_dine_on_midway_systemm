import { prisma } from "../db";
import { filterStopsByCorridor, type RouteCoords } from "../geo";
import { isRestaurantOpen } from "../restaurants";
import { toNumber, parseJsonArray } from "../utils";

export type DiscoveredRestaurant = {
  id: string;
  name: string;
  slug: string;
  cuisine: string;
  description: string;
  imageUrl: string | null;
  address: string;
  rating: number;
  ratingCount: number;
  latitude: number;
  longitude: number;
  distanceFromRouteMeters: number;
  detourMeters: number;
  routeProgress: number;
  etaMinutes: number;
  prepTimeMinutes: number;
  openNow: boolean;
  openingTime: string;
  closingTime: string;
  activeOrders: number;
  capacityPerHour: number;
  priceRange: { min: number; max: number };
  dietaryTags: string[];
  menuPreview: Array<{
    id: string;
    name: string;
    price: number;
    prepTimeMinutes: number;
    dietaryTags: string[];
    imageUrl: string | null;
  }>;
  suitability: "great" | "tight" | "preorder";
  suitabilityLabel: string;
};

export async function discoverRestaurants(journey: {
  routeGeometry: unknown;
  routeDurationSeconds: number;
  corridorMeters: number;
}): Promise<DiscoveredRestaurant[]> {
  const route = Array.isArray(journey.routeGeometry) ? (journey.routeGeometry as RouteCoords) : [];
  if (route.length < 2) return [];

  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true, verificationStatus: "VERIFIED" },
    include: {
      menuItems: {
        where: { isAvailable: true, isArchived: false },
        orderBy: [{ category: "asc" }, { price: "asc" }],
      },
      orders: {
        where: { status: { in: ["ACCEPTED", "PREPARING", "READY"] } },
        select: { id: true },
      },
    },
  });

  const matches = filterStopsByCorridor(
    restaurants.map((r) => ({ id: r.id, latitude: r.latitude, longitude: r.longitude })),
    route,
    journey.corridorMeters,
  );
  const byId = new Map(matches.map((m) => [m.id, m]));
  const now = new Date();

  return restaurants
    .map((restaurant) => {
      const match = byId.get(restaurant.id);
      if (!match) return null;
      const openNow = isRestaurantOpen(restaurant, now);
      const etaMinutes = Math.max(2, Math.round((journey.routeDurationSeconds * match.routeProgress) / 60));
      const menu = restaurant.menuItems;
      const avgs = menu.length
        ? Math.round(menu.reduce((sum, item) => sum + item.prepTimeMinutes, 0) / menu.length)
        : restaurant.averagePrepMinutes;
      const tags = [...new Set(menu.flatMap((item) => parseJsonArray(item.dietaryTags)))];
      const prices = menu.map((item) => toNumber(item.price));
      const enoughTime = etaMinutes >= avgs + 5;
      const suitability = !enoughTime ? "preorder" : etaMinutes >= avgs + 12 ? "great" : "tight";
      return {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        cuisine: restaurant.cuisine,
        description: restaurant.description,
        imageUrl: restaurant.imageUrl,
        address: restaurant.address,
        rating: toNumber(restaurant.rating),
        ratingCount: restaurant.ratingCount,
        latitude: toNumber(restaurant.latitude),
        longitude: toNumber(restaurant.longitude),
        distanceFromRouteMeters: match.distanceFromRouteMeters,
        detourMeters: match.detourMeters,
        routeProgress: match.routeProgress,
        etaMinutes,
        prepTimeMinutes: avgs,
        openNow,
        openingTime: restaurant.openingTime,
        closingTime: restaurant.closingTime,
        activeOrders: restaurant.orders.length,
        capacityPerHour: restaurant.capacityPerHour,
        priceRange: {
          min: prices.length ? Math.min(...prices) : 0,
          max: prices.length ? Math.max(...prices) : 0,
        },
        dietaryTags: tags,
        menuPreview: menu.slice(0, 4).map((item) => ({
          id: item.id,
          name: item.name,
          price: toNumber(item.price),
          prepTimeMinutes: item.prepTimeMinutes,
          dietaryTags: parseJsonArray(item.dietaryTags),
          imageUrl: item.imageUrl,
        })),
        suitability: suitability as DiscoveredRestaurant["suitability"],
        suitabilityLabel:
          suitability === "great"
            ? "Great time buffer"
            : suitability === "tight"
              ? "Tight but doable"
              : "Pre-order to make it",
      };
    })
    .filter((r): r is DiscoveredRestaurant => r !== null)
    .sort((a, b) => a.etaMinutes - b.etaMinutes);
}

export async function getCustomerRestaurantMenu(restaurantId: string, journeyId?: string | null) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      menuItems: {
        where: { isAvailable: true, isArchived: false },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      },
      orders: {
        where: { status: { in: ["ACCEPTED", "PREPARING", "READY"] } },
        select: { id: true },
      },
    },
  });
  if (!restaurant || !restaurant.isActive) return null;

  let journey: {
    id: string;
    corridorMeters: number;
    routeDurationSeconds: number;
    startLabel: string;
    endLabel: string;
  } | null = null;
  let corridorMatch: {
    distanceFromRouteMeters: number;
    detourMeters: number;
    routeProgress: number;
    etaMinutes: number;
  } | null = null;

  if (journeyId) {
    // The caller must have already verified ownership of a customer journey.
    const owned = await prisma.journey.findUnique({ where: { id: journeyId } });
    if (owned) {
      const route = Array.isArray(owned.routeGeometry) ? (owned.routeGeometry as RouteCoords) : [];
      const match = filterStopsByCorridor(
        [{ id: restaurant.id, latitude: restaurant.latitude, longitude: restaurant.longitude }],
        route,
        owned.corridorMeters,
      );
      if (match[0]) {
        corridorMatch = {
          ...match[0],
          etaMinutes: Math.max(
            2,
            Math.round((owned.routeDurationSeconds * match[0].routeProgress) / 60),
          ),
        };
      }
      journey = {
        id: owned.id,
        corridorMeters: owned.corridorMeters,
        routeDurationSeconds: owned.routeDurationSeconds,
        startLabel: owned.startLabel,
        endLabel: owned.endLabel,
      };
    }
  }

  return {
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      description: restaurant.description,
      cuisine: restaurant.cuisine,
      imageUrl: restaurant.imageUrl,
      address: restaurant.address,
      latitude: toNumber(restaurant.latitude),
      longitude: toNumber(restaurant.longitude),
      phone: restaurant.phone,
      pickupInstructions: restaurant.pickupInstructions,
      openingTime: restaurant.openingTime,
      closingTime: restaurant.closingTime,
      rating: toNumber(restaurant.rating),
      ratingCount: restaurant.ratingCount,
      openNow: isRestaurantOpen(restaurant),
      activeOrders: restaurant.orders.length,
      capacityPerHour: restaurant.capacityPerHour,
      verificationStatus: restaurant.verificationStatus,
    },
    menu: restaurant.menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: toNumber(item.price),
      category: item.category,
      prepTimeMinutes: item.prepTimeMinutes,
      imageUrl: item.imageUrl,
      dietaryTags: parseJsonArray(item.dietaryTags),
      allergens: parseJsonArray(item.allergens),
      isAvailable: item.isAvailable,
    })),
    corridorMatch,
    journey,
  };
}
