import { prisma } from "@/lib/db";
import { requireApiRestaurant } from "@/lib/auth/guards";
import { handleApiError, jsonOk } from "@/lib/http";
import { getSchedulerStatus } from "@/lib/services/kitchen-scheduler";
import { toNumber } from "@/lib/utils";

export async function GET() {
  try {
    const context = await requireApiRestaurant();
    const restaurantId = context.restaurant.id;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [orders, pendingOffers, todayOrderCount, todayCompleted, statusGroups] = await Promise.all([
      prisma.order.findMany({
        where: { restaurantId, status: { in: ["ACCEPTED", "PREPARING", "READY"] } },
        orderBy: [{ cookingStartAt: "asc" }, { createdAt: "asc" }],
        include: {
          customer: { select: { id: true, name: true } },
          items: { select: { nameSnapshot: true, quantity: true } },
        },
      }),
      prisma.bountyOffer.count({
        where: { restaurantId, status: "PENDING", bounty: { status: "OPEN" } },
      }),
      prisma.order.count({ where: { restaurantId, createdAt: { gte: startOfDay } } }),
      prisma.order.findMany({
        where: { restaurantId, status: "COMPLETED", createdAt: { gte: startOfDay } },
        select: { total: true },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: { restaurantId },
        _count: { _all: true },
      }),
    ]);

    const counts = {
      PENDING: 0,
      ACCEPTED: 0,
      PREPARING: 0,
      READY: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      REJECTED: 0,
      ...Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])),
    };

    const revenueToday = moneySum(todayCompleted.map((o) => toNumber(o?.total)));
    const queue = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      customerName: order.customer.name.split(" ")[0],
      itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
      itemPreview: order.items.map((i) => `${i.quantity}× ${i.nameSnapshot}`).join(", "),
      total: toNumber(order.total),
      prepTimeMinutes: order.prepTimeMinutes,
      estimatedReadyAt: order.estimatedReadyAt,
      etaUpdatedAt: order.etaUpdatedAt,
      cookingStartAt: order.cookingStartAt,
      cookNotifiedAt: order.cookNotifiedAt,
      kitchenWarning: order.kitchenWarning,
      createdAt: order.createdAt,
    }));

    const workloadMinutes = orders.reduce((sum, order) => sum + order.prepTimeMinutes, 0);
    const capacity = context.restaurant.capacityPerHour;

    return jsonOk({
      restaurant: context.restaurant,
      counts,
      today: {
        orderCount: todayOrderCount,
        completedCount: todayCompleted.length,
        revenue: revenueToday,
      },
      pendingOffers,
      queue,
      workload: {
        activeOrders: orders.length,
        capacityPerHour: capacity,
        utilisation: capacity > 0 ? Math.round((orders.length / capacity) * 100) : 0,
        prepMinutesQueued: workloadMinutes,
      },
      scheduler: getSchedulerStatus(),
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function moneySum(values: number[]) {
  return Math.round(values.reduce((sum, v) => sum + v, 0) * 100) / 100;
}
