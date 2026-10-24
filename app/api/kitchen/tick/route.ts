import { runKitchenTick } from "@/lib/services/kitchen-scheduler";
import { handleApiError, jsonError, jsonOk } from "@/lib/http";
import { config } from "@/lib/config";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    return request.headers.get("x-cron-secret") === secret;
  }
  return config.demoMode;
}

export async function POST(request: Request) {
  try {
    if (!authorized(request)) {
      return jsonError("Cron endpoint is not configured.", 403, "forbidden");
    }
    const result = await runKitchenTick();
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: Request) {
  return POST(request);
}
