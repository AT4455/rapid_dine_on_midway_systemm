import { config } from "./config";
import { haversineMeters, type LatLng, type RouteCoords } from "./geo";

export type RoutingResult = {
  geometry: RouteCoords;
  distanceMeters: number;
  durationSeconds: number;
  provider: string;
  isFallback: boolean;
  warning?: string;
};

type OsrmResponse = {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: { coordinates?: [number, number][] };
  }>;
  message?: string;
};

function withTimeout(ms: number) {
  return AbortSignal.timeout(ms);
}

function fallbackRoute(start: LatLng, end: LatLng, reason: string): RoutingResult {
  const direct = haversineMeters(start, end);
  const midLat = (start.lat + end.lat) / 2;
  const midLng = (start.lng + end.lng) / 2;
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  // Offset the midpoint perpendicular to the straight line to avoid drawing a
  // ruler-straight route. This is explicitly presented as a fallback estimate.
  const offset = Math.min(0.12, Math.max(0.01, direct / 4_000_000));
  const ctrlLat = midLat - dx * offset;
  const ctrlLng = midLng + dy * offset;

  const points: RouteCoords = [];
  const steps = 32;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat =
      (1 - t) ** 2 * start.lat + 2 * (1 - t) * t * ctrlLat + t ** 2 * end.lat;
    const lng =
      (1 - t) ** 2 * start.lng + 2 * (1 - t) * t * ctrlLng + t ** 2 * end.lng;
    points.push([Number(lng.toFixed(6)), Number(lat.toFixed(6))]);
  }

  const distance = Math.max(250, Math.round(direct * 1.18));
  const duration = Math.max(90, Math.round((distance / 1000 / config.routing.fallbackSpeedKph) * 3600));
  return {
    geometry: points,
    distanceMeters: distance,
    durationSeconds: duration,
    provider: "fallback",
    isFallback: true,
    warning: `Routing provider unavailable${reason ? ` (${reason})` : ""}. Showing a labelled straight-line estimate — not live traffic data.`,
  };
}

export async function getDrivingRoute(start: LatLng, end: LatLng): Promise<RoutingResult> {
  if (config.routing.provider === "mock") {
    return fallbackRoute(start, end, "ROUTING_PROVIDER=mock");
  }

  const url = `${config.routing.baseUrl}/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=false`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(config.routing.apiKey ? { Authorization: `Bearer ${config.routing.apiKey}` } : {}),
      },
      signal: withTimeout(config.routing.timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return fallbackRoute(start, end, `HTTP ${res.status}`);
    const json = (await res.json()) as OsrmResponse;
    const route = json.routes?.[0];
    if (json.code !== "Ok" || !route || !route.geometry?.coordinates?.length) {
      return fallbackRoute(start, end, json.message || "no route returned");
    }
    return {
      geometry: route.geometry.coordinates as RouteCoords,
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      provider: "osrm",
      isFallback: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    return fallbackRoute(start, end, message.slice(0, 80));
  }
}

export async function getLiveEtaSeconds(
  current: LatLng,
  restaurant: LatLng,
): Promise<{ seconds: number; source: "provider" | "fallback" } | null> {
  try {
    const route = await getDrivingRoute(current, restaurant);
    return { seconds: route.durationSeconds, source: route.isFallback ? "fallback" : "provider" };
  } catch {
    return null;
  }
}
