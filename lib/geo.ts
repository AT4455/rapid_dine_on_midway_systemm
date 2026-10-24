import {
  booleanPointInPolygon,
  buffer,
  length as turfLength,
  lineString,
  nearestPointOnLine,
  point,
  pointToLineDistance,
} from "@turf/turf";

export type LatLng = { lat: number; lng: number };
/** GeoJSON order: [longitude, latitude] */
export type RouteCoords = [number, number][];

/** Anything with a reliable string form, including Prisma.Decimal. */
export type NumericValue = { toString(): string };

export type RouteStop = {
  id: string;
  latitude: NumericValue;
  longitude: NumericValue;
};

export type CorridorMatch = {
  id: string;
  distanceFromRouteMeters: number;
  detourMeters: number;
  routeProgress: number;
  etaSeconds: number;
};

const EARTH_METERS_PER_DEGREE = 111_320;

export function toLine(route: RouteCoords) {
  return lineString(route);
}

export function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function sanitizeRouteCoords(raw: unknown): RouteCoords {
  if (!Array.isArray(raw)) return [];
  const out: RouteCoords = [];
  for (const pair of raw) {
    if (
      Array.isArray(pair) &&
      pair.length >= 2 &&
      typeof pair[0] === "number" &&
      typeof pair[1] === "number" &&
      Number.isFinite(pair[0]) &&
      Number.isFinite(pair[1]) &&
      Math.abs(pair[0]) <= 180 &&
      Math.abs(pair[1]) <= 90
    ) {
      out.push([pair[0], pair[1]]);
    }
  }
  return out;
}

/**
 * Route corridor matching.
 *
 * Approximation: we buffer the routing-provider polyline by the customer's
 * chosen corridor distance and keep restaurant points inside that polygon.
 * "Detour" is approximated as twice the perpendicular distance from the
 * polyline (out and back) — it is not a live turn-by-turn detour. A real
 * deployment should ask the routing provider for the route via each stop.
 */
export function filterStopsByCorridor<T extends RouteStop>(
  stops: T[],
  route: RouteCoords,
  corridorMeters: number,
) {
  const matches: (T & CorridorMatch)[] = [];
  if (route.length < 2) return matches;
  const line = toLine(route);
  const totalMeters = turfLength(line, { units: "meters" }) || 1;

  let corridorPolygon: ReturnType<typeof buffer> | null = null;
  try {
    corridorPolygon = buffer(line, corridorMeters / 1000, { units: "kilometers" });
  } catch {
    corridorPolygon = null; // fall back to distance-only matching
  }

  for (const stop of stops) {
    const stopPoint = point([Number(stop.longitude), Number(stop.latitude)]);
    const distance = pointToLineDistance(stopPoint, line, { units: "meters" });
    const inside = corridorPolygon
      ? booleanPointInPolygon(stopPoint, corridorPolygon)
      : distance <= corridorMeters;
    if (!inside || distance > corridorMeters) continue;

    const nearest = nearestPointOnLine(line, stopPoint, { units: "meters" });
    const location = Number(nearest.properties.location ?? 0);
    matches.push({
      ...stop,
      distanceFromRouteMeters: Math.round(distance),
      detourMeters: Math.round(distance * 2),
      routeProgress: Math.min(1, Math.max(0, location / totalMeters)),
      etaSeconds: 0,
    });
  }
  return matches;
}

export function pointToRouteProgress(route: RouteCoords, current: LatLng) {
  if (route.length < 2) return 0;
  const line = toLine(route);
  const total = turfLength(line, { units: "meters" }) || 1;
  const nearest = nearestPointOnLine(line, point([current.lng, current.lat]), {
    units: "meters",
  });
  return Math.min(1, Math.max(0, Number(nearest.properties.location ?? 0) / total));
}

/**
 * Estimates remaining drive time to a stop as a fraction of the journey's
 * driving duration. This is deliberately labelled an estimate in the UI; when
 * the routing provider is reachable, live location updates also ask it for a
 * fresh current-position → restaurant route.
 */
export function estimateStopEtaSeconds(
  route: RouteCoords,
  routeDurationSeconds: number,
  current: LatLng | null,
  stopProgress: number,
) {
  const progress = current ? pointToRouteProgress(route, current) : 0;
  const remaining = Math.max(0, stopProgress - progress);
  if (remaining <= 0.005) return Math.round(routeDurationSeconds * 0.02);
  return Math.max(60, Math.round(routeDurationSeconds * remaining));
}

export function routePointsEvery(route: RouteCoords, maxPoints = 80): RouteCoords {
  if (route.length <= maxPoints) return route;
  const step = Math.ceil(route.length / maxPoints);
  const sampled = route.filter((_, i) => i % step === 0);
  const last = route[route.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

/** Bounding box used to limit geocoding search results. */
export function boundingBox(route: RouteCoords, paddingKm = 3) {
  if (!route.length) return null;
  const lats = route.map((c) => c[1]);
  const lngs = route.map((c) => c[0]);
  const padLat = paddingKm / EARTH_METERS_PER_DEGREE;
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const padLng = paddingKm / (EARTH_METERS_PER_DEGREE * Math.cos((midLat * Math.PI) / 180));
  return {
    minLat: Math.min(...lats) - padLat,
    maxLat: Math.max(...lats) + padLat,
    minLng: Math.min(...lngs) - padLng,
    maxLng: Math.max(...lngs) + padLng,
  };
}
