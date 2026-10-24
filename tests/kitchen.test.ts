import { describe, expect, it } from "vitest";
import {
  calculatePrepMinutes,
  canTransition,
  planKitchenTiming,
  validNextStatuses,
} from "@/lib/kitchen";

const NOW = new Date("2026-05-13T12:00:00.000Z");
const minutes = (value: number) => value * 60_000;

describe("calculatePrepMinutes", () => {
  it("returns zero for an empty basket", () => {
    expect(calculatePrepMinutes([])).toBe(0);
  });

  it("uses the longest dish for parallel cooking", () => {
    expect(calculatePrepMinutes([{ prepTimeMinutes: 15, quantity: 1 }])).toBe(15);
  });

  it("adds a handling cost for extra quantities", () => {
    expect(calculatePrepMinutes([{ prepTimeMinutes: 20, quantity: 3 }])).toBe(22);
  });

  it("never returns less than five minutes for a real basket", () => {
    expect(calculatePrepMinutes([{ prepTimeMinutes: 1, quantity: 1 }])).toBe(5);
  });

  it("caps the estimate at three hours", () => {
    expect(calculatePrepMinutes([{ prepTimeMinutes: 179, quantity: 10 }])).toBe(180);
  });
});

describe("planKitchenTiming", () => {
  it("starts prep at ETA minus preparation time", () => {
    const timing = planKitchenTiming({
      etaAt: new Date(NOW.getTime() + minutes(30)),
      prepTimeMinutes: 20,
      now: NOW,
    });

    expect(timing.minutesUntilArrival).toBe(30);
    expect(timing.cookingStartAt.getTime()).toBe(NOW.getTime() + minutes(10));
    expect(timing.tooSoon).toBe(false);
    expect(timing.shouldStartNow).toBe(false);
    expect(timing.warning).toBeNull();
  });

  it("flags a tight arrival and starts immediately", () => {
    const timing = planKitchenTiming({
      etaAt: new Date(NOW.getTime() + minutes(10)),
      prepTimeMinutes: 20,
      now: NOW,
      bufferMinutes: 5,
    });

    expect(timing.tooSoon).toBe(true);
    expect(timing.shouldStartNow).toBe(true);
    expect(timing.cookingStartAt.getTime()).toBe(NOW.getTime());
    expect(timing.warning).toMatch(/Start now/i);
  });

  it("does not start in the past when ETA is sooner than prep", () => {
    const timing = planKitchenTiming({
      etaAt: new Date(NOW.getTime() + minutes(2)),
      prepTimeMinutes: 45,
      now: NOW,
    });

    expect(timing.cookingStartAt.getTime()).toBeGreaterThanOrEqual(NOW.getTime());
  });

  it("warns when no ETA is available", () => {
    const timing = planKitchenTiming({ etaAt: null, prepTimeMinutes: 20, now: NOW });

    expect(timing.warning).toMatch(/No live arrival ETA/i);
    expect(timing.shouldStartNow).toBe(true);
  });

  it("waits before starting when no ETA and prep is short", () => {
    const timing = planKitchenTiming({ etaAt: null, prepTimeMinutes: 5, now: NOW });

    expect(timing.cookingStartAt.getTime()).toBe(NOW.getTime() + minutes(10));
    expect(timing.shouldStartNow).toBe(false);
  });

  it("warns about a stale ETA only when arrival is not already tight", () => {
    const timing = planKitchenTiming({
      etaAt: new Date(NOW.getTime() + minutes(60)),
      prepTimeMinutes: 10,
      now: NOW,
      etaUpdatedAt: new Date(NOW.getTime() - minutes(20)),
      staleAfterMinutes: 10,
    });

    expect(timing.staleEta).toBe(true);
    expect(timing.warning).toMatch(/has not refreshed/i);
  });

  it("prioritises the tight-arrival warning over a stale ETA", () => {
    const timing = planKitchenTiming({
      etaAt: new Date(NOW.getTime() + minutes(8)),
      prepTimeMinutes: 20,
      now: NOW,
      etaUpdatedAt: new Date(NOW.getTime() - minutes(30)),
      staleAfterMinutes: 10,
    });

    expect(timing.staleEta).toBe(true);
    expect(timing.tooSoon).toBe(true);
    expect(timing.warning).toMatch(/Start now/i);
  });
});

describe("order status transitions", () => {
  it("lets a restaurant move an accepted order into cooking", () => {
    expect(canTransition("ACCEPTED", "PREPARING", "RESTAURANT")).toBe(true);
    expect(canTransition("PREPARING", "READY", "RESTAURANT")).toBe(true);
    expect(canTransition("READY", "COMPLETED", "RESTAURANT")).toBe(true);
    expect(canTransition("ACCEPTED", "COMPLETED", "RESTAURANT")).toBe(false);
  });

  it("lets a customer cancel only before cooking", () => {
    expect(canTransition("PENDING", "CANCELLED", "CUSTOMER")).toBe(true);
    expect(canTransition("ACCEPTED", "CANCELLED", "CUSTOMER")).toBe(true);
    expect(canTransition("PREPARING", "CANCELLED", "CUSTOMER")).toBe(false);
    expect(canTransition("READY", "CANCELLED", "CUSTOMER")).toBe(false);
  });

  it("does not let a customer advance cooking", () => {
    expect(canTransition("ACCEPTED", "PREPARING", "CUSTOMER")).toBe(false);
    expect(canTransition("PREPARING", "READY", "CUSTOMER")).toBe(false);
  });

  it("allows the system to use any declared transition", () => {
    expect(canTransition("PENDING", "ACCEPTED", "SYSTEM")).toBe(true);
    expect(canTransition("PENDING", "COMPLETED", "SYSTEM")).toBe(false);
    expect(canTransition("COMPLETED", "CANCELLED", "SYSTEM")).toBe(false);
  });

  it("returns only valid next statuses for the actor", () => {
    expect(validNextStatuses("PREPARING", "RESTAURANT")).toEqual(["READY", "CANCELLED"]);
    expect(validNextStatuses("PREPARING", "CUSTOMER")).toEqual([]);
    expect(validNextStatuses("COMPLETED", "RESTAURANT")).toEqual([]);
  });
});
