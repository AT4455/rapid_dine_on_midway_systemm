import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../http";
import { canTransition, ORDER_STATUS_META, type ActorRole } from "../kitchen";
import { createNotification } from "../notifications";
import { emitToOrder, emitToRestaurant } from "../realtime/server";

export const orderInclude = {
  restaurant: {
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      cuisine: true,
      address: true,
      latitude: true,
      longitude: true,
      phone: true,
      pickupInstructions: true,
      openingTime: true,
      closingTime: true,
    },
  },
  customer: { select: { id: true, name: true, phone: true, email: true } },
  items: true,
  statusHistory: { orderBy: { createdAt: "asc" as const } },
  journey: {
    select: {
      id: true,
      startLabel: true,
      endLabel: true,
      startLatitude: true,
      startLongitude: true,
      endLatitude: true,
      endLongitude: true,
      routeGeometry: true,
      routeDurationSeconds: true,
      routeDistanceMeters: true,
      corridorMeters: true,
      status: true,
      lastLocationAt: true,
      lastEtaAt: true,
    },
  },
  bounty: { select: { id: true, note: true, budget: true, pickupEtaMinutes: true, estimatedArrivalAt: true } },
} satisfies Prisma.OrderInclude;

export type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export async function updateOrderStatus(params: {
  orderId: string;
  actor: { role: ActorRole; userId: string; restaurantId?: string };
  toStatus: OrderStatus;
  note?: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      restaurant: { select: { id: true, name: true, pickupInstructions: true } },
      customer: { select: { id: true, name: true } },
    },
  });
  if (!order) throw new HttpError(404, "Order not found.", "not_found");

  if (params.actor.role === "CUSTOMER" && order.customerId !== params.actor.userId) {
    throw new HttpError(403, "You cannot change this order.", "forbidden");
  }
  if (params.actor.role === "RESTAURANT" && order.restaurantId !== params.actor.restaurantId) {
    throw new HttpError(403, "You can only manage your own restaurant's orders.", "forbidden");
  }
  if (params.actor.role === "SYSTEM" && process.env.NODE_ENV !== "test") {
    throw new HttpError(403, "System transitions are internal only.", "forbidden");
  }

  if (!canTransition(order.status, params.toStatus, params.actor.role)) {
    throw new HttpError(
      409,
      `Cannot move an order from ${ORDER_STATUS_META[order.status].label} to ${ORDER_STATUS_META[params.toStatus].label}.`,
      "invalid_transition",
      { from: order.status, to: params.toStatus },
    );
  }

  if (
    (params.toStatus === "CANCELLED" || params.toStatus === "REJECTED") &&
    !params.note?.trim()
  ) {
    throw new HttpError(422, "Add a short reason for cancelling or rejecting.", "note_required");
  }

  const now = new Date();
  const data: Prisma.OrderUpdateManyMutationInput = { status: params.toStatus };
  if (params.toStatus === "PREPARING") {
    data.preparingAt = now;
    if (!order.cookNotifiedAt) data.cookNotifiedAt = now;
  }
  if (params.toStatus === "READY") data.readyAt = now;
  if (params.toStatus === "COMPLETED") data.completedAt = now;
  if (params.toStatus === "CANCELLED" || params.toStatus === "REJECTED") data.cancelledAt = now;

  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data,
    });
    if (result.count !== 1) {
      throw new HttpError(409, "The order changed while you were updating it. Refresh and try again.", "stale_order");
    }
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: params.toStatus,
        actorId: params.actor.userId,
        actorRole: params.actor.role,
        note: params.note?.slice(0, 300),
      },
    });
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  });

  emitToOrder(
    changed.id,
    "order:statusUpdated",
    { orderId: changed.id, status: changed.status, at: now.toISOString() },
    { customerId: changed.customerId, restaurantId: changed.restaurantId },
  );

  if (params.actor.role === "RESTAURANT") {
    await createNotification({
      userId: changed.customerId,
      type: "ORDER_STATUS",
      title: `${changed.restaurant.name}: ${ORDER_STATUS_META[params.toStatus].label}`,
      body:
        params.toStatus === "PREPARING"
          ? `Your order ${changed.orderNumber} is being prepared for your arrival.`
          : params.toStatus === "READY"
            ? `Order ${changed.orderNumber} is ready at the pickup counter.`
            : params.toStatus === "COMPLETED"
              ? `Order ${changed.orderNumber} is complete. Enjoy the rest of your journey.`
              : `Order ${changed.orderNumber}: ${ORDER_STATUS_META[params.toStatus].description}`,
      orderId: changed.id,
      data: { orderId: changed.id, status: changed.status },
      dedupeKey: `order-status:${changed.id}:${changed.status}`,
    });
  } else {
    emitToRestaurant(changed.restaurantId, "order:statusUpdated", {
      orderId: changed.id,
      status: changed.status,
      at: now.toISOString(),
    });
    await createNotification({
      userId: changed.customerId,
      type: "ORDER_STATUS",
      title: `Order ${changed.orderNumber} cancelled`,
      body: params.note ?? "The traveller cancelled this order.",
      orderId: changed.id,
      data: { orderId: changed.id, status: changed.status },
      dedupeKey: `order-status:${changed.id}:${changed.status}`,
    });
  }

  return changed;
}
