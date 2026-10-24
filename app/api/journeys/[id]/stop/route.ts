import { requireApiCustomer } from "@/lib/auth/guards";
import { assertSameOrigin, handleApiError, jsonOk } from "@/lib/http";
import { stopTracking } from "@/lib/services/tracking";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiCustomer();
    const { id } = await context.params;
    const result = await stopTracking(user.id, id);
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
