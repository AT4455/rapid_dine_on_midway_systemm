import { prisma } from "@/lib/db";
import { requireApiCustomer } from "@/lib/auth/guards";
import { handleApiError, HttpError, jsonOk } from "@/lib/http";
import { discoverRestaurants } from "@/lib/services/discovery";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiCustomer();
    const { id } = await context.params;
    const journey = await prisma.journey.findFirst({
      where: { id, customerId: user.id },
      include: {
        bounties: {
          where: { status: { in: ["OPEN", "ACCEPTED"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { items: true, offers: { select: { status: true } } },
        },
        orders: {
          where: { status: { in: ["ACCEPTED", "PREPARING", "READY"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!journey) throw new HttpError(404, "Journey not found.", "not_found");

    const restaurants = await discoverRestaurants(journey);
    return jsonOk({ journey, restaurants });
  } catch (error) {
    return handleApiError(error);
  }
}
