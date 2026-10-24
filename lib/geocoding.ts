import { config } from "./config";

export type GeocodeResult = {
  id: string;
  label: string;
  shortLabel: string;
  lat: number;
  lng: number;
  source: "nominatim" | "demo";
  type?: string;
};

/** Offline fallback places used when Nominatim is unreachable or rate-limited. */
export const DEMO_PLACES: GeocodeResult[] = [
  { id: "demo-blr", label: "Bengaluru, Karnataka, India", shortLabel: "Bengaluru", lat: 12.9716, lng: 77.5946, source: "demo", type: "city" },
  { id: "demo-blr-airport", label: "Kempegowda International Airport, Bengaluru", shortLabel: "Bengaluru Airport", lat: 13.1986, lng: 77.7066, source: "demo", type: "aerodrome" },
  { id: "demo-kengeri", label: "Kengeri, Bengaluru, Karnataka", shortLabel: "Kengeri", lat: 12.9172, lng: 77.4845, source: "demo", type: "suburb" },
  { id: "demo-bidadi", label: "Bidadi, Ramanagara, Karnataka", shortLabel: "Bidadi", lat: 12.8018, lng: 77.3866, source: "demo", type: "town" },
  { id: "demo-ramanagara", label: "Ramanagara, Karnataka, India", shortLabel: "Ramanagara", lat: 12.7209, lng: 77.2802, source: "demo", type: "city" },
  { id: "demo-channapatna", label: "Channapatna, Karnataka, India", shortLabel: "Channapatna", lat: 12.6514, lng: 77.2065, source: "demo", type: "town" },
  { id: "demo-maddur", label: "Maddur, Mandya, Karnataka", shortLabel: "Maddur", lat: 12.5847, lng: 77.045, source: "demo", type: "town" },
  { id: "demo-mandya", label: "Mandya, Karnataka, India", shortLabel: "Mandya", lat: 12.5223, lng: 76.8954, source: "demo", type: "city" },
  { id: "demo-srirangapatna", label: "Srirangapatna, Mandya, Karnataka", shortLabel: "Srirangapatna", lat: 12.4181, lng: 76.6947, source: "demo", type: "town" },
  { id: "demo-mysuru", label: "Mysuru, Karnataka, India", shortLabel: "Mysuru", lat: 12.2958, lng: 76.6394, source: "demo", type: "city" },
  { id: "demo-tumakuru", label: "Tumakuru, Karnataka, India", shortLabel: "Tumakuru", lat: 13.3379, lng: 77.1173, source: "demo", type: "city" },
  { id: "demo-hassan", label: "Hassan, Karnataka, India", shortLabel: "Hassan", lat: 13.0072, lng: 76.0962, source: "demo", type: "city" },
];

type NominatimItem = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  importance?: number;
  address?: Record<string, string>;
};

function shorten(label: string) {
  return label.split(",")[0]?.trim() || label;
}

function demoSearch(query: string) {
  const q = query.trim().toLowerCase();
  const matches = DEMO_PLACES.filter(
    (p) => p.label.toLowerCase().includes(q) || p.shortLabel.toLowerCase().includes(q),
  );
  return matches.length ? matches : DEMO_PLACES.slice(0, 6);
}

export async function searchPlaces(
  query: string,
  options: { limit?: number; nearLat?: number; nearLng?: number } = {},
): Promise<{ results: GeocodeResult[]; fallback: boolean; warning?: string }> {
  const q = query.trim();
  if (q.length < 2) return { results: [], fallback: false };
  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    limit: String(options.limit ?? 6),
    addressdetails: "1",
  });
  if (options.nearLat != null && options.nearLng != null) {
    const d = 1.5;
    params.set(
      "viewbox",
      `${options.nearLng - d},${options.nearLat + d},${options.nearLng + d},${options.nearLat - d}`,
    );
  }

  try {
    const res = await fetch(`${config.geocoding.baseUrl}/search?${params.toString()}`, {
      headers: {
        "User-Agent": config.geocoding.userAgent,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(config.geocoding.timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = (await res.json()) as NominatimItem[];
    if (!Array.isArray(items) || !items.length) {
      const demo = demoSearch(q);
      return {
        results: demo,
        fallback: true,
        warning: "No live address matches. Showing labelled demo locations.",
      };
    }
    return {
      results: items.map((item) => ({
        id: `osm-${item.place_id}`,
        label: item.display_name,
        shortLabel: shorten(item.display_name),
        lat: Number(item.lat),
        lng: Number(item.lon),
        source: "nominatim" as const,
        type: item.type,
      })),
      fallback: false,
    };
  } catch {
    return {
      results: demoSearch(q),
      fallback: true,
      warning: "Address search is offline. Showing labelled demo locations along the sample route.",
    };
  }
}
