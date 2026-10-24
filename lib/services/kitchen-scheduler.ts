import { prisma } from "../db";
import { planKitchenTiming } from "../kitchen";
import { notifyRestaurantMembers } from "../notifications";
import { emitToOrder, emitToRestaurant } from "../realtime/server";
import { expireStaleBounties } from "./bounty";

let tickRunning = false;
let lastTickAt: Date | null = null;
let lastTickResult = { started: 0, expiredBounties: 0 };

/**
 * Persistent just-in-time scheduler.
 *
 * Every tick looks for ACCEPTED orders whose persisted cookingStartAt has
 * arrived and whose cookNotifiedAt is still null. The conditional updateMany
 * is the idempotency guard: only one worker can claim the notification, and
 * the unique Notification.dedupeKey protects staff from duplicate alerts.
 */
export async function runKitchenTick(now = new Date()) {
  if (tickRunning) return { skipped: true, started: 0, expiredBounties: 0 };
  tickRunning = true;
  try {
    const due = await prisma.order.findMany({
      where: {
        status: "ACCEPTED",
        cookNotifiedAt: null,
        cookingStartAt: { lte: now },
      },
      select: {
        id: true,
        customerId: true,
        restaurantId: true,
        prepTimeMinutes: true,
        estimatedReadyAt: true,
        etaUpdatedAt: true,
        kitchenWarning: true,
        restaurant: { select: { name: true } },
      },
      take: 30,
      orderBy: { cookingStartAt: "asc" },
    });

    let started = 0;
    for (const order of due) {
      const claimed = await prisma.order.updateMany({
        where: { id: order.id, status: "ACCEPTED", cookNotifiedAt: null },
        data: { cookNotifiedAt: now },
      });
      if (claimed.count !== 1) continue;

      const timing = planKitchenTiming({
        etaAt: order.estimatedReadyAt,
        prepTimeMinutes: order.prepTimeMinutes,
        now,
        etaUpdatedAt: order.etaUpdatedAt,
      });

      emitToRestaurant(order.restaurantId, "kitchen:startCooking", {
        orderId: order.id,
        cookingStartAt: timing.cookingStartAt.toISOString(),
        minutesUntilArrival: timing.minutesUntilArrival,
      });
      emitToOrder(
        order.id,
        "kitchen:startCooking",
        {
          orderId: order.id,
          cookingStartAt: timing.cookingStartAt.toISOString(),
          minutesUntilArrival: timing.minutesUntilArrival,
        },
        { customerId: order.customerId, restaurantId: order.restaurantId },
      );

      await notifyRestaurantMembers(order.restaurantId, {
        type: "KITCHEN_START",
        title: "Start cooking now",
        body: `Order due at the counter in ${timing.minutesUntilArrival} min. Prep window: ${order.prepTimeMinutes} min.${timing.tooSoon ? " Arrival is tight — notify the traveller if needed." : ""}`,
        orderId: order.id,
        data: {
          orderId: order.id,
          cookingStartAt: timing.cookingStartAt.toISOString(),
          minutesUntilArrival: timing.minutesUntilArrival,
        },
        dedupeKey: `kitchen-start:${order.id}`,
      });
      started += 1;
    }

    const expiredBounties = await expireStaleBounties();
    lastTickAt = now;
    lastTickResult = { started, expiredBounties };
    return { skipped: false, started, expiredBounties, at: now };
  } finally {
    tickRunning = false;
  }
}

export function getSchedulerStatus() {
  return { lastTickAt, ...lastTickResult, running: tickRunning };
}
