import { describe, expect, it } from "vitest";
import {
  evaluateRestaurant,
  feesForSubtotal,
  normalizeDishName,
  orderTotals,
  type RequestedDish,
} from "@/lib/matching";

const NOW = new Date("2026-05-13T12:00:00");
const DAY = NOW.getDay();

type Candidate = Parameters<typeof evaluateRestaurant>[0];

function menuItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    restaurantId: "restaurant-1",
    name: "Masala Dosa",
    description: "Crisp dosa with potato masala",
    price: 200,
    category: "Mains",
    prepTimeMinutes: 12,
    imageUrl: null,
    dietaryTags: ["VEGETARIAN"],
    allergens: [],
    isAvailable: true,
    isArchived: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeRestaurant(overrides: Record<string, unknown> = {}): Candidate {
  return {
    id: "restaurant-1",
    name: "Bidadi Tiffin Room",
    slug: "bidadi-tiffin",
    description: "A demo kitchen",
    cuisine: "South Indian",
    imageUrl: null,
    address: "Bidadi, Karnataka",
    latitude: 12.8018,
    longitude: 77.3866,
    phone: "08000000000",
    email: "kitchen@example.com",
    pickupInstructions: "Collect at the counter",
    openingTime: "00:00",
    closingTime: "00:00",
    openDays: [DAY],
    averagePrepMinutes: 15,
    capacityPerHour: 10,
    verificationStatus: "VERIFIED",
    rating: 4.5,
    ratingCount: 20,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    menuItems: [menuItem()],
    orders: [],
    memberships: [{ userId: "owner-1" }],
    ...overrides,
  } as unknown as Candidate;
}

const corridor = { distanceFromRouteMeters: 0, detourMeters: 0, routeProgress: 0.5 };
const requested: RequestedDish[] = [{ dishName: "Masala Dosa", quantity: 2 }];

function evaluate(overrides: Record<string, unknown> = {}, budget = 500, preferredId?: string) {
  return evaluateRestaurant(
    makeRestaurant(overrides),
    requested,
    budget,
    corridor,
    3600,
    NOW,
    preferredId,
  );
}

describe("fee maths", () => {
  it("adds a 3% service fee and a ₹5 platform fee", () => {
    expect(feesForSubtotal(1000)).toBe(35);
    expect(orderTotals(1000)).toEqual({ subtotal: 1000, fees: 35, total: 1035 });
  });

  it("rounds paise-safe", () => {
    expect(feesForSubtotal(333.33)).toBe(15);
    expect(orderTotals(333.33)).toEqual({ subtotal: 333.33, fees: 15, total: 348.33 });
  });
});

describe("normalizeDishName", () => {
  it("trims, lowercases and collapses whitespace", () => {
    expect(normalizeDishName("  Masala   DOSA ")).toBe("masala dosa");
  });
});

describe("evaluateRestaurant", () => {
  it("builds an offer with fees, prep time and an ETA", () => {
    const result = evaluate();
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;

    expect(result.offer.total).toBe(417); // 400 + 12 service + 5 platform
    expect(result.offer.fees).toBe(17);
    expect(result.offer.prepTimeMinutes).toBe(14); // 12 + handling for the second item
    expect(result.offer.etaSeconds).toBe(1800);
    expect(result.offer.etaMinutes).toBe(30);
    expect(result.offer.items).toHaveLength(1);
    expect(result.offer.items[0]).toMatchObject({ quantity: 2, unitPrice: 200 });
    expect(result.offer.isPreferred).toBe(false);
  });

  it("matches dish names case-insensitively", () => {
    const result = evaluateRestaurant(
      makeRestaurant(),
      [{ dishName: "  masala   dosa ", quantity: 1 }],
      500,
      corridor,
      3600,
      NOW,
    );
    expect(result.eligible).toBe(true);
  });

  it("flags the preferred restaurant", () => {
    const result = evaluate({}, 500, "restaurant-1");
    expect(result.eligible).toBe(true);
    if (result.eligible) expect(result.offer.isPreferred).toBe(true);
  });

  it("rejects a budget that does not cover prices and fees", () => {
    const result = evaluate({}, 400);
    expect(result).toEqual({
      eligible: false,
      reason: "Dish prices plus fees exceed the traveller's budget",
    });
  });

  it("rejects unavailable or missing dishes", () => {
    const unavailable = evaluate({ menuItems: [menuItem({ isAvailable: false })] });
    expect(unavailable.eligible).toBe(false);
    if (!unavailable.eligible) expect(unavailable.reason).toMatch(/Masala Dosa/);

    const missing = evaluate({ menuItems: [] });
    expect(missing.eligible).toBe(false);
    if (!missing.eligible) expect(missing.reason).toMatch(/No available/);
  });

  it("rejects archived dishes", () => {
    expect(evaluate({ menuItems: [menuItem({ isArchived: true })] }).eligible).toBe(false);
  });

  it("rejects a kitchen at capacity", () => {
    const result = evaluate({ capacityPerHour: 2, orders: [{ id: "a" }, { id: "b" }] });
    expect(result).toEqual({ eligible: false, reason: "Kitchen is at capacity" });
  });

  it("rejects inactive or unverified kitchens", () => {
    expect(evaluate({ isActive: false })).toEqual({ eligible: false, reason: "Restaurant is inactive" });
    expect(evaluate({ verificationStatus: "PENDING" })).toEqual({
      eligible: false,
      reason: "Restaurant is not verified",
    });
  });

  it("rejects a kitchen that is closed at this time", () => {
    const result = evaluate({ openingTime: "13:00", closingTime: "14:00" });
    expect(result).toEqual({ eligible: false, reason: "Restaurant is closed right now" });
  });
});
