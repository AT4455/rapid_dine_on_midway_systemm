import { requireApiUser } from "@/lib/auth/guards";
import { clientIp, handleApiError, jsonOk } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { searchPlaces } from "@/lib/geocoding";
import { geocodeQuerySchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    enforceRateLimit(`geocode:${user.id}`, 40, 60_000);
    enforceRateLimit(`geocode-ip:${clientIp(request)}`, 80, 60_000);
    const url = new URL(request.url);
    const query = geocodeQuerySchema.parse({
      q: url.searchParams.get("q") ?? "",
      nearLat: url.searchParams.get("nearLat") ?? undefined,
      nearLng: url.searchParams.get("nearLng") ?? undefined,
    });
    const result = await searchPlaces(query.q, {
      nearLat: query.nearLat,
      nearLng: query.nearLng,
      limit: 6,
    });
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
