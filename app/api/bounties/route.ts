import { prisma } from "@/lib/db";
import { requireApiCustomer, requireApiUser, getRestaurantContext } from "@/lib/auth/guards";
import { assertSameOrigin, handleApiError, HttpError, jsonOk, readJson } from "@/lib/http";
import { bountyCreateSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createBounty } from "@/lib/services/bounty";

export async function GET() {
  try {
    const user = await requireApiUser();
    if (user.role === "CUSTOMER") {
      const bounties = await prisma.bounty.findMany({
        where: { customerId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          items: true,
          acceptedRestaurant: { select: { id: true, name: true, cuisine: true, imageUrl: true } },
          order: { select: { id: true, orderNumber: true, status: true, total: true, estimatedReadyAt: true } },
          offers: { select: { status: true } },
        },
      });
      return jsonOk({ bounties });
    }

    const context = await getRestaurantContext(user.id);
    if (!context) throw new HttpError(403, "No restaurant linked.", "no_restaurant");
    const offers = await prisma.bountyOffer.findMany({
      where: { restaurantId: context.restaurant.id, status: "PENDING", bounty: { status: "OPEN" } },
      orderBy: { createdAt: "desc" },
      include: {
        bounty: {
          include: {
            items: true,
            customer: { select: { name: true } },
            journey: {
              select: {
                id: true,
                startLabel: true,
                endLabel: true,
                routeGeometry: true,
                routeDurationSeconds: true,
                corridorMeters: true,
                lastEtaAt: true,
                lastLocationAt: true,
                status: true,
              },
            },
          },
        },
      },
    });
    return jsonOk({ offers });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiCustomer();
    enforceRateLimit(`bounty:${user.id}`, 8, 10 * 60_000);
    const body = bountyCreateSchema.parse(await readJson(request));
    const result = await createBounty(user.id, body);
    return jsonOk(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
