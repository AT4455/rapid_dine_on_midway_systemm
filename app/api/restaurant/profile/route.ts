import { prisma } from "@/lib/db";
import { requireApiRestaurant } from "@/lib/auth/guards";
import { assertSameOrigin, handleApiError, jsonOk, readJson } from "@/lib/http";
import { restaurantProfileSchema } from "@/lib/validation";
import { toNumber } from "@/lib/utils";

export async function GET() {
  try {
    const context = await requireApiRestaurant();
    const restaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { id: context.restaurant.id },
    });
    return jsonOk({
      restaurant: {
        ...restaurant,
        latitude: toNumber(restaurant.latitude),
        longitude: toNumber(restaurant.longitude),
        rating: toNumber(restaurant.rating),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireApiRestaurant();
    const body = restaurantProfileSchema.parse(await readJson(request));
    const restaurant = await prisma.restaurant.update({
      where: { id: context.restaurant.id },
      data: {
        name: body.name,
        description: body.description,
        cuisine: body.cuisine,
        address: body.address,
        latitude: body.latitude,
        longitude: body.longitude,
        phone: body.phone,
        openingTime: body.openingTime,
        closingTime: body.closingTime,
        pickupInstructions: body.pickupInstructions,
        capacityPerHour: body.capacityPerHour,
        imageUrl: body.imageUrl || null,
        openDays: body.openDays,
      },
    });
    return jsonOk({ restaurant });
  } catch (error) {
    return handleApiError(error);
  }
}
