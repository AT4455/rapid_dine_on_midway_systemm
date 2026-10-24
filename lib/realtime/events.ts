export const SOCKET_EVENTS = {
  bountyCreated: "bounty:created",
  bountyAccepted: "bounty:accepted",
  bountyRejected: "bounty:rejected",
  orderStatusUpdated: "order:statusUpdated",
  etaUpdated: "customer:etaUpdated",
  kitchenStart: "kitchen:startCooking",
  notification: "notification:new",
} as const;

export type RealtimePayloads = {
  "bounty:created": { bountyId: string; restaurantId: string; budget: number; itemCount: number; etaMinutes: number };
  "bounty:accepted": { bountyId: string; orderId: string; restaurantId: string; restaurantName: string };
  "bounty:rejected": { bountyId: string; restaurantId: string; reason?: string };
  "order:statusUpdated": { orderId: string; status: string; at: string };
  "customer:etaUpdated": {
    orderId: string;
    journeyId: string;
    etaMinutes: number;
    etaAt: string;
    source: "provider" | "fallback" | "simulated";
    recordedAt: string;
  };
  "kitchen:startCooking": { orderId: string; cookingStartAt: string; minutesUntilArrival: number };
  "notification:new": { id: string; title: string; body: string; type: string; createdAt: string };
};

export type SocketEventName = keyof RealtimePayloads;

export function userRoom(userId: string) {
  return `user:${userId}`;
}
export function restaurantRoom(restaurantId: string) {
  return `restaurant:${restaurantId}`;
}
export function orderRoom(orderId: string) {
  return `order:${orderId}`;
}
export function bountyRoom(bountyId: string) {
  return `bounty:${bountyId}`;
}
