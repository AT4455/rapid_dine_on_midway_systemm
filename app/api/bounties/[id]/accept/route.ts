import { requireApiRestaurant } from "@/lib/auth/guards";
import { assertSameOrigin, handleApiError, jsonOk } from "@/lib/http";
import { acceptBounty } from "@/lib/services/bounty";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const restaurant = await requireApiRestaurant();
    const { id } = await context.params;
    const order = await acceptBounty({
      bountyId: id,
      restaurantId: restaurant.restaurant.id,
      userId: restaurant.user.id,
    });
    return jsonOk({ order }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
