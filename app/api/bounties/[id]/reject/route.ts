import { requireApiRestaurant } from "@/lib/auth/guards";
import { assertSameOrigin, handleApiError, jsonOk, readJson } from "@/lib/http";
import { bountyRejectSchema } from "@/lib/validation";
import { rejectBounty } from "@/lib/services/bounty";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const restaurant = await requireApiRestaurant();
    const { id } = await context.params;
    const body = bountyRejectSchema.parse(await readJson(request));
    const result = await rejectBounty({
      bountyId: id,
      restaurantId: restaurant.restaurant.id,
      userId: restaurant.user.id,
      reason: body.reason,
    });
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
