import { requireApiCustomer } from "@/lib/auth/guards";
import { assertSameOrigin, handleApiError, jsonOk } from "@/lib/http";
import { cancelBounty } from "@/lib/services/bounty";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiCustomer();
    const { id } = await context.params;
    return jsonOk(await cancelBounty(user.id, id));
  } catch (error) {
    return handleApiError(error);
  }
}
