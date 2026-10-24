import { describe, expect, it } from "vitest";
import {
  boundingBox,
  filterStopsByCorridor,
  pointToRouteProgress,
  routePointsEvery,
  sanitizeRouteCoords,
  estimateStopEtaSeconds,
  haversineMeters,
  type RouteCoords,
} from "@/lib/geo";

const ROUTE: RouteCoords = [
  [77.5946, 12.9716], // Bengaluru
  [77.3866, 12.8018], // Bidadi
  [77.2802, 12.7209], // Ramanagara
  [77.045, 12.5847], // Maddur
  [76.8954, 12.5223], // Mandya
  [76.6947, 12.4181], // Srirangapatna
  [76.6394, 12.2958], // Mysuru
];

describe("filterStopsByCorridor", () => {
  it("keeps stops inside the corridor and reports detour and progress", () => {
    const matches = filterStopsByCorridor(
      [
        { id: "bidadi", latitude: 12.8018, longitude: 77.3866 },
        { id: "mysuru", latitude: 12.2958, longitude: 76.6394 },
        { id: "far", latitude: 13.5, longitude: 78.5 },
      ],
      ROUTE,
      3000,
    );

    expect(matches.map((match) => match.id)).toEqual(["bidadi", "mysuru"]);
    for (const match of matches) {
      expect(match.distanceFromRouteMeters).toBeLessThan(20);
      expect(match.detourMeters).toBe(match.distanceFromRouteMeters * 2);
      expect(match.routeProgress).toBeGreaterThanOrEqual(0);
      expect(match.routeProgress).toBeLessThanOrEqual(1);
    }
    expect(matches[0].routeProgress).toBeGreaterThan(0);
    expect(matches[1].routeProgress).toBeGreaterThan(matches[0].routeProgress);
  });

  it("excludes a kitchen just outside a tight corridor", () => {
    const offRoute = { id: "off", latitude: 12.92, longitude: 77.5 };
    expect(filterStopsByCorridor([offRoute], ROUTE, 1000)).toHaveLength(0);
    expect(filterStopsByCorridor([offRoute], ROUTE, 15000)).toHaveLength(1);
  });

  it("returns nothing for an unusable route", () => {
    expect(filterStopsByCorridor([{ id: "a", latitude: 12.8, longitude: 77.3 }], [], 3000)).toEqual([]);
    expect(filterStopsByCorridor([{ id: "a", latitude: 12.8, longitude: 77.3 }], [[77.3, 12.8]], 3000)).toEqual([]);
  });
});

describe("pointToRouteProgress", () => {
  it("is near zero at the start and near one at the destination", () => {
    expect(pointToRouteProgress(ROUTE, { lat: 12.9716, lng: 77.5946 })).toBeLessThan(0.02);
    expect(pointToRouteProgress(ROUTE, { lat: 12.2958, lng: 76.6394 })).toBeGreaterThan(0.98);
  });

  it("returns zero for a missing route", () => {
    expect(pointToRouteProgress([], { lat: 12, lng: 77 })).toBe(0);
  });
});

describe("estimateStopEtaSeconds", () => {
  it("scales remaining drive time by route progress", () => {
    expect(estimateStopEtaSeconds(ROUTE, 7200, null, 0.5)).toBe(3600);
  });

  it("uses a small minimum when already at the stop", () => {
    expect(estimateStopEtaSeconds(ROUTE, 7200, null, 0)).toBe(144);
  });

  it("accounts for the current position", () => {
    const atMidpoint = { lat: 12.7209, lng: 77.2802 };
    expect(estimateStopEtaSeconds(ROUTE, 7200, atMidpoint, 0.8)).toBeGreaterThan(0);
    expect(estimateStopEtaSeconds(ROUTE, 7200, atMidpoint, 0.2)).toBe(144);
  });
});

describe("route helpers", () => {
  it("sanitizes invalid coordinate pairs", () => {
    expect(
      sanitizeRouteCoords([
        [77.5, 12.9],
        ["77.5", 12.9],
        [77.5, 12.9, 0],
        [200, 12.9],
        [77.5, 100],
        [Number.NaN, 12.9],
      ]),
    ).toEqual([
      [77.5, 12.9],
      [77.5, 12.9],
    ]);
  });

  it("samples long routes while preserving the destination", () => {
    const longRoute: RouteCoords = Array.from({ length: 400 }, (_, index) => [77 + index * 0.001, 12 + index * 0.001]);
    const sampled = routePointsEvery(longRoute, 50);
    expect(sampled.length).toBeLessThanOrEqual(51);
    expect(sampled.at(-1)).toEqual(longRoute.at(-1));
  });

  it("computes a padded bounding box", () => {
    const box = boundingBox(ROUTE, 3);
    expect(box).not.toBeNull();
    if (!box) return;
    expect(box.minLat).toBeLessThan(12.2958);
    expect(box.maxLat).toBeGreaterThan(12.9716);
    expect(box.minLng).toBeLessThan(76.6394);
    expect(box.maxLng).toBeGreaterThan(77.5946);
  });

  it("returns null for an empty route", () => {
    expect(boundingBox([])).toBeNull();
  });

  it("computes haversine distances", () => {
    const distance = haversineMeters({ lat: 12.9716, lng: 77.5946 }, { lat: 12.2958, lng: 76.6394 });
    expect(distance).toBeGreaterThan(100_000);
    expect(distance).toBeLessThan(160_000);
  });
});
