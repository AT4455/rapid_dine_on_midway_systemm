import type { NotificationType } from "@prisma/client";
import { prisma } from "./db";
import { emitToRestaurant, emitToUser } from "./realtime/server";

type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  restaurantId?: string;
  orderId?: string;
  bountyId?: string;
  data?: Record<string, unknown>;
  dedupeKey?: string;
};

export async function createNotification(input: NotifyInput) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title.slice(0, 160),
        body: input.body.slice(0, 2000),
        restaurantId: input.restaurantId,
        orderId: input.orderId,
        bountyId: input.bountyId,
        data: input.data as object | undefined,
        dedupeKey: input.dedupeKey,
      },
    });
    emitToUser(input.userId, "notification:new", {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      createdAt: notification.createdAt.toISOString(),
    });
    return notification;
  } catch (error) {
    // A duplicate dedupeKey is expected when the scheduler retries. Do not
    // create duplicate kitchen notifications.
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return null;
    }
    console.error("Notification failed", error);
    return null;
  }
}

export async function notifyRestaurantMembers(
  restaurantId: string,
  input: Omit<NotifyInput, "userId" | "restaurantId">,
) {
  const members = await prisma.restaurantMembership.findMany({
    where: { restaurantId },
    select: { userId: true },
  });
  const created = await Promise.all(
    members.map((member) =>
      createNotification({
        ...input,
        userId: member.userId,
        restaurantId,
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:u:${member.userId}` : undefined,
      }),
    ),
  );
  const first = created.find(Boolean);
  if (first) {
    emitToRestaurant(restaurantId, "notification:new", {
      id: first.id,
      title: first.title,
      body: first.body,
      type: first.type,
      createdAt: first.createdAt.toISOString(),
    });
  }
  return created.filter(Boolean);
}

export async function listNotifications(userId: string, limit = 30) {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unread };
}
