import { getAuthUser, getRestaurantContext } from "@/lib/auth/guards";
import { handleApiError, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return jsonOk({ user: null, restaurant: null });
    const restaurant = user.role === "RESTAURANT" ? await getRestaurantContext(user.id) : null;
    return jsonOk({
      user,
      restaurant: restaurant
        ? {
            id: restaurant.restaurant.id,
            name: restaurant.restaurant.name,
            role: restaurant.membershipRole,
            verificationStatus: restaurant.restaurant.verificationStatus,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
