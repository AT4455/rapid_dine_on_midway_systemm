import { cache } from "react";
import { prisma } from "../db";
import { HttpError } from "../http";
import { getSession } from "./session";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: "CUSTOMER" | "RESTAURANT";
  avatarUrl: string | null;
  isDemo: boolean;
  createdAt: Date;
};

export type RestaurantContext = {
  user: AuthUser;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    cuisine: string;
    address: string;
    verificationStatus: string;
    isActive: boolean;
    capacityPerHour: number;
    pickupInstructions: string;
  };
  membershipRole: "OWNER" | "STAFF";
};

/** Loads the user from MySQL and verifies the JWT role matches the DB role. */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      avatarUrl: true,
      isDemo: true,
      createdAt: true,
    },
  });
  if (!user || user.role !== session.role) return null;
  return user as AuthUser;
});

export async function requireApiUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) throw new HttpError(401, "Please sign in to continue.", "unauthenticated");
  return user;
}

export async function requireApiCustomer(): Promise<AuthUser> {
  const user = await requireApiUser();
  if (user.role !== "CUSTOMER") {
    throw new HttpError(403, "A traveller account is required for this action.", "forbidden");
  }
  return user;
}

export async function getRestaurantContext(userId?: string): Promise<RestaurantContext | null> {
  const user = userId ? null : await getAuthUser();
  const uid = userId ?? user?.id;
  if (!uid) return null;
  const membership = await prisma.restaurantMembership.findFirst({
    where: { userId: uid },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
          cuisine: true,
          address: true,
          verificationStatus: true,
          isActive: true,
          capacityPerHour: true,
          pickupInstructions: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          avatarUrl: true,
          isDemo: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return null;
  return {
    user: membership.user as AuthUser,
    restaurant: membership.restaurant,
    membershipRole: membership.role,
  };
}

export async function requireApiRestaurant(): Promise<RestaurantContext> {
  const user = await requireApiUser();
  if (user.role !== "RESTAURANT") {
    throw new HttpError(403, "A restaurant partner account is required.", "forbidden");
  }
  const context = await getRestaurantContext(user.id);
  if (!context) {
    throw new HttpError(403, "No restaurant is linked to this account.", "no_restaurant");
  }
  return context;
}

/** Verifies a customer owns the given order (or is the restaurant partner). */
export async function assertOrderAccess(orderId: string) {
  const user = await requireApiUser();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      restaurant: { select: { id: true, name: true } },
      items: true,
    },
  });
  if (!order) throw new HttpError(404, "Order not found.", "not_found");
  if (user.role === "CUSTOMER") {
    if (order.customerId !== user.id) throw new HttpError(403, "You cannot access this order.", "forbidden");
    return { user, order, side: "customer" as const };
  }
  const context = await getRestaurantContext(user.id);
  if (!context || context.restaurant.id !== order.restaurantId) {
    throw new HttpError(403, "You cannot access this order.", "forbidden");
  }
  return { user, order, side: "restaurant" as const, context };
}

export { assertRestaurantOwns } from "./authorization";
