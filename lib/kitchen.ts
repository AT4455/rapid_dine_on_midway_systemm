import type { OrderStatus } from "@prisma/client";
import { config } from "./config";

export type KitchenItem = { prepTimeMinutes: number; quantity: number };

/**
 * Restaurant kitchens work on several items in parallel, so the dominant
 * preparation time is the longest dish plus a small sequential handling cost
 * for extra quantities. Documented approximation (not a queue simulation).
 */
export function calculatePrepMinutes(items: KitchenItem[]) {
  if (!items.length) return 0;
  const longest = Math.max(...items.map((i) => i.prepTimeMinutes));
  const extraItems = Math.max(0, items.reduce((sum, i) => sum + i.quantity, 0) - 1);
  return Math.min(180, Math.max(5, longest + Math.ceil(extraItems / 2) * 2));
}

export type KitchenTiming = {
  cookingStartAt: Date;
  minutesUntilArrival: number;
  tooSoon: boolean;
  staleEta: boolean;
  warning: string | null;
  shouldStartNow: boolean;
};

/**
 * startCookingAfter = max(0, customerETA - preparationTime)
 * expressed as an absolute, persistent timestamp.
 */
export function planKitchenTiming(input: {
  etaAt: Date | null;
  prepTimeMinutes: number;
  now?: Date;
  etaUpdatedAt?: Date | null;
  staleAfterMinutes?: number;
  bufferMinutes?: number;
}): KitchenTiming {
  const now = input.now ?? new Date();
  const staleAfter = input.staleAfterMinutes ?? config.kitchen.staleEtaMinutes;
  const buffer = input.bufferMinutes ?? config.kitchen.tooSoonBufferMinutes;
  const etaAt = input.etaAt;
  const etaMinutes = etaAt ? (etaAt.getTime() - now.getTime()) / 60000 : 0;
  const startAt = etaAt
    ? new Date(Math.max(now.getTime(), etaAt.getTime() - input.prepTimeMinutes * 60000))
    : new Date(now.getTime() + Math.max(0, 15 - input.prepTimeMinutes) * 60000);

  const tooSoon = Boolean(etaAt && etaMinutes < input.prepTimeMinutes + buffer);
  const staleEta = Boolean(
    input.etaUpdatedAt &&
      now.getTime() - input.etaUpdatedAt.getTime() > staleAfter * 60000,
  );

  let warning: string | null = null;
  if (!etaAt) {
    warning = "No live arrival ETA yet. Confirm the pickup time with the traveller.";
  } else if (tooSoon) {
    warning = `Arrival is in ${Math.max(0, Math.round(etaMinutes))} min but preparation needs ${input.prepTimeMinutes} min. Start now and tell the traveller if you will be late.`;
  } else if (staleEta) {
    warning = `The traveller's ETA has not refreshed in over ${staleAfter} min. Treat the arrival time as stale.`;
  }

  return {
    cookingStartAt: startAt,
    minutesUntilArrival: Math.round(etaMinutes),
    tooSoon,
    staleEta,
    warning,
    shouldStartNow: startAt.getTime() <= now.getTime() + 15_000,
  };
}

export function kitchenCountdownLabel(cookingStartAt: Date, now = new Date()) {
  const diff = cookingStartAt.getTime() - now.getTime();
  if (diff <= 0) return "Start cooking now";
  const mins = Math.ceil(diff / 60000);
  return `Start in ${mins} min`;
}

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export type ActorRole = "CUSTOMER" | "RESTAURANT" | "SYSTEM";

export function canTransition(from: OrderStatus, to: OrderStatus, actor: ActorRole) {
  if (!TRANSITIONS[from]?.includes(to)) return false;
  if (actor === "SYSTEM") return true;
  if (actor === "CUSTOMER") {
    return to === "CANCELLED" && (from === "PENDING" || from === "ACCEPTED");
  }
  // Restaurant
  if (from === "PENDING") return to === "ACCEPTED" || to === "REJECTED" || to === "CANCELLED";
  if (from === "ACCEPTED") return to === "PREPARING" || to === "CANCELLED";
  if (from === "PREPARING") return to === "READY" || to === "CANCELLED";
  if (from === "READY") return to === "COMPLETED" || to === "CANCELLED";
  return false;
}

export function validNextStatuses(from: OrderStatus, actor: ActorRole): OrderStatus[] {
  return (TRANSITIONS[from] ?? []).filter((to) => canTransition(from, to, actor));
}

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; tone: "neutral" | "green" | "orange" | "blue" | "red"; description: string }
> = {
  PENDING: { label: "Pending", tone: "neutral", description: "Waiting for the kitchen to accept." },
  ACCEPTED: { label: "Accepted", tone: "green", description: "The kitchen is holding your slot." },
  PREPARING: { label: "Preparing", tone: "orange", description: "Your food is being cooked now." },
  READY: { label: "Ready for pickup", tone: "blue", description: "Collect at the counter on arrival." },
  COMPLETED: { label: "Completed", tone: "green", description: "Picked up. Enjoy your journey." },
  CANCELLED: { label: "Cancelled", tone: "red", description: "This order was cancelled." },
  REJECTED: { label: "Rejected", tone: "red", description: "The kitchen could not take this order." },
};
