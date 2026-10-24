import { prisma } from "@/lib/db";
import { requireApiCustomer } from "@/lib/auth/guards";
import { handleApiError, HttpError, jsonOk } from "@/lib/http";
import { getCustomerRestaurantMenu } from "@/lib/services/discovery";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiCustomer();
    const { id } = await context.params;
    const journeyId = new URL(request.url).searchParams.get("journeyId");

    if (journeyId) {
      const journey = await prisma.journey.findFirst({
        where: { id: journeyId, customerId: user.id },
        select: { id: true },
      });
      if (!journey) throw new HttpError(404, "Journey not found.", "journey_not_found");
    }

    const data = await getCustomerRestaurantMenu(id, journeyId);
    if (!data) throw new HttpError(404, "Restaurant not found.", "not_found");
    return jsonOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}
