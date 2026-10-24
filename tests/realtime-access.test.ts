import { describe, expect, it } from "vitest";
import { canAccessBountyRoom, canAccessOrderRoom } from "@/lib/realtime/access";

const order = { customerId: "customer-1", restaurantId: "restaurant-1" };

describe("canAccessOrderRoom", () => {
  it("allows the customer who owns the order", () => {
    expect(
      canAccessOrderRoom({ role: "CUSTOMER", userId: "customer-1", restaurantIds: [], order }),
    ).toBe(true);
  });

  it("blocks another customer", () => {
    expect(
      canAccessOrderRoom({ role: "CUSTOMER", userId: "customer-2", restaurantIds: [], order }),
    ).toBe(false);
  });

  it("allows a member of the restaurant that owns the order", () => {
    expect(
      canAccessOrderRoom({
        role: "RESTAURANT",
        userId: "staff-1",
        restaurantIds: ["restaurant-1"],
        order,
      }),
    ).toBe(true);
  });

  it("blocks staff from another restaurant", () => {
    expect(
      canAccessOrderRoom({
        role: "RESTAURANT",
        userId: "staff-2",
        restaurantIds: ["restaurant-2"],
        order,
      }),
    ).toBe(false);
  });

  it("blocks a restaurant account with no memberships", () => {
    expect(canAccessOrderRoom({ role: "RESTAURANT", userId: "staff-1", restaurantIds: [], order })).toBe(false);
  });
});

const bounty = {
  customerId: "customer-1",
  acceptedRestaurantId: null as string | null,
  offers: [{ restaurantId: "restaurant-1" }, { restaurantId: "restaurant-2" }],
};

describe("canAccessBountyRoom", () => {
  it("allows the customer who created the bounty", () => {
    expect(
      canAccessBountyRoom({ role: "CUSTOMER", userId: "customer-1", restaurantIds: [], bounty }),
    ).toBe(true);
  });

  it("blocks another customer", () => {
    expect(
      canAccessBountyRoom({ role: "CUSTOMER", userId: "customer-9", restaurantIds: [], bounty }),
    ).toBe(false);
  });

  it("allows a kitchen that received an offer", () => {
    expect(
      canAccessBountyRoom({
        role: "RESTAURANT",
        userId: "owner-1",
        restaurantIds: ["restaurant-2"],
        bounty,
      }),
    ).toBe(true);
  });

  it("blocks a kitchen that was never offered the bounty", () => {
    expect(
      canAccessBountyRoom({
        role: "RESTAURANT",
        userId: "owner-3",
        restaurantIds: ["restaurant-3"],
        bounty,
      }),
    ).toBe(false);
  });

  it("still allows the accepted kitchen if its offer list changed", () => {
    expect(
      canAccessBountyRoom({
        role: "RESTAURANT",
        userId: "owner-1",
        restaurantIds: ["restaurant-1"],
        bounty: { ...bounty, acceptedRestaurantId: "restaurant-1", offers: [] },
      }),
    ).toBe(true);
  });
});
