import { describe, expect, it } from "vitest";
import {
  capacityLabel,
  dietaryMatchScore,
  isRestaurantOpen,
  nextOpeningLabel,
  type OpeningHours,
} from "@/lib/restaurants";

function at(hour: number, minute = 0) {
  return new Date(2026, 4, 13, hour, minute, 0, 0); // local time
}

function hours(overrides: Partial<OpeningHours> = {}): OpeningHours {
  return {
    openingTime: "09:00",
    closingTime: "17:00",
    openDays: [at(12).getDay()],
    ...overrides,
  };
}

describe("isRestaurantOpen", () => {
  it("is open inside the window on an open day", () => {
    expect(isRestaurantOpen(hours(), at(12))).toBe(true);
  });

  it("is closed before opening and at closing time", () => {
    expect(isRestaurantOpen(hours(), at(8, 59))).toBe(false);
    expect(isRestaurantOpen(hours(), at(17))).toBe(false);
  });

  it("is closed on a day that is not selected", () => {
    const tomorrow = (at(12).getDay() + 1) % 7;
    expect(isRestaurantOpen(hours({ openDays: [tomorrow] }), at(12))).toBe(false);
  });

  it("supports overnight windows", () => {
    const overnight = hours({ openingTime: "18:00", closingTime: "02:00" });
    expect(isRestaurantOpen(overnight, at(23))).toBe(true);
    expect(isRestaurantOpen(overnight, at(1))).toBe(true);
    expect(isRestaurantOpen(overnight, at(12))).toBe(false);
  });

  it("treats equal opening and closing times as 24 hours", () => {
    const allDay = hours({ openingTime: "00:00", closingTime: "00:00" });
    expect(isRestaurantOpen(allDay, at(3))).toBe(true);
    expect(isRestaurantOpen(allDay, at(23, 59))).toBe(true);
  });

  it("treats a missing day list as every day", () => {
    expect(isRestaurantOpen(hours({ openDays: null }), at(12))).toBe(true);
  });
});

describe("restaurant labels", () => {
  it("scores dietary preference matches", () => {
    expect(dietaryMatchScore([], ["VEGAN"])).toBe(0);
    expect(dietaryMatchScore(["VEGAN"], ["VEGAN", "SPICY"])).toBe(1);
    expect(dietaryMatchScore(["VEGAN", "JAIN"], ["vegan"])).toBe(1);
    expect(dietaryMatchScore(["VEGAN"], [])).toBe(0);
  });

  it("labels capacity bands", () => {
    expect(capacityLabel(0, 10)).toEqual({ label: "Taking orders", tone: "free" });
    expect(capacityLabel(8, 10)).toEqual({ label: "Busy kitchen", tone: "warm" });
    expect(capacityLabel(10, 10)).toEqual({ label: "Kitchen full", tone: "busy" });
    expect(capacityLabel(1, 0)).toEqual({ label: "Kitchen full", tone: "busy" });
  });

  it("describes the next opening day", () => {
    expect(nextOpeningLabel(hours({ openDays: [] }), at(12))).toBe("Daily 09:00");
    const today = at(12).getDay();
    expect(nextOpeningLabel(hours({ openDays: [today] }), at(12))).toBe("Today 09:00");
    const tomorrow = (today + 1) % 7;
    expect(nextOpeningLabel(hours({ openDays: [tomorrow] }), at(12))).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) 09:00$/);
  });
});
