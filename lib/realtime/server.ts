import type { Server } from "socket.io";
import {
  bountyRoom,
  orderRoom,
  restaurantRoom,
  userRoom,
  type RealtimePayloads,
} from "./events";

const globalForRealtime = globalThis as unknown as { rdSocketServer?: Server };

export function setRealtimeServer(io: Server) {
  globalForRealtime.rdSocketServer = io;
}

export function getRealtimeServer() {
  return globalForRealtime.rdSocketServer ?? null;
}

/**
 * All emits are funnelled through server-side room helpers. API routes never
 * accept a room name from the browser, which prevents broadcasting private
 * order or location data to unrelated clients.
 */
export function emitToUser<K extends keyof RealtimePayloads>(userId: string, event: K, payload: RealtimePayloads[K]) {
  getRealtimeServer()?.to(userRoom(userId)).emit(event, payload);
}

export function emitToRestaurant<K extends keyof RealtimePayloads>(
  restaurantId: string,
  event: K,
  payload: RealtimePayloads[K],
) {
  getRealtimeServer()?.to(restaurantRoom(restaurantId)).emit(event, payload);
}

export function emitToOrder<K extends keyof RealtimePayloads>(
  orderId: string,
  event: K,
  payload: RealtimePayloads[K],
  extra?: { customerId?: string; restaurantId?: string },
) {
  const io = getRealtimeServer();
  if (!io) return;
  io.to(orderRoom(orderId)).emit(event, payload);
  if (extra?.customerId) io.to(userRoom(extra.customerId)).emit(event, payload);
  if (extra?.restaurantId) io.to(restaurantRoom(extra.restaurantId)).emit(event, payload);
}

export function emitToBounty<K extends keyof RealtimePayloads>(
  bountyId: string,
  event: K,
  payload: RealtimePayloads[K],
) {
  getRealtimeServer()?.to(bountyRoom(bountyId)).emit(event, payload);
}
