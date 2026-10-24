/**
 * Pure room-authorization rules shared by the Socket.IO gateway. Keeping them
 * separate from the socket handlers makes the privacy boundary easy to test:
 * a browser never chooses a room name, and these checks decide whether its
 * authenticated identity may join an order or bounty room.
 */

export type SocketRole = "CUSTOMER" | "RESTAURANT";

export type OrderRoomFacts = {
  customerId: string;
  restaurantId: string;
};

export type BountyRoomFacts = {
  customerId: string;
  acceptedRestaurantId: string | null;
  offers: Array<{ restaurantId: string }>;
};

export function canAccessOrderRoom(params: {
  role: SocketRole;
  userId: string;
  restaurantIds: string[];
  order: OrderRoomFacts;
}) {
  if (params.role === "CUSTOMER") {
    return params.order.customerId === params.userId;
  }
  return params.restaurantIds.includes(params.order.restaurantId);
}

export function canAccessBountyRoom(params: {
  role: SocketRole;
  userId: string;
  restaurantIds: string[];
  bounty: BountyRoomFacts;
}) {
  if (params.role === "CUSTOMER") {
    return params.bounty.customerId === params.userId;
  }
  if (params.bounty.acceptedRestaurantId && params.restaurantIds.includes(params.bounty.acceptedRestaurantId)) {
    return true;
  }
  return params.bounty.offers.some((offer) => params.restaurantIds.includes(offer.restaurantId));
}
