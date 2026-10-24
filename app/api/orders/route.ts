import { prisma } from "@/lib/db";
import { getRestaurantContext, requireApiUser } from "@/lib/auth/guards";
import { handleApiError, jsonOk } from "@/lib/http";
import { ORDER_STATUS_META } from "@/lib/kitchen";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const status = new URL(request.url).searchParams.get("status");
    const where = status && status in ORDER_STATUS_META ? { status: status as keyof typeof ORDER_STATUS_META } : {};

    if (user.role === "CUSTOMER") {
      const orders = await prisma.order.findMany({
        where: { customerId: user.id, ...where },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          restaurant: { select: { id: true, name: true, cuisine: true, imageUrl: true, address: true } },
          items: true,
        },
      });
      return jsonOk({ orders });
    }

    const context = await getRestaurantContext(user.id);
    if (!context) return jsonOk({ orders: [] });
    const orders = await prisma.order.findMany({
      where: { restaurantId: context.restaurant.id, ...where },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: true,
      },
    });
    return jsonOk({ orders });
  } catch (error) {
    return handleApiError(error);
  }
}
