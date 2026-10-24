import { HttpError } from "../http";

/** Structural shape so this guard can be tested without a database row. */
export type RestaurantOwnership = { restaurant: { id: string } };

export function assertRestaurantOwns(
  context: RestaurantOwnership,
  restaurantId: string,
  message = "You can only manage your own restaurant.",
) {
  if (context.restaurant.id !== restaurantId) {
    throw new HttpError(403, message, "forbidden");
  }
}
