import { prisma } from "@/lib/db";
import { requireApiRestaurant } from "@/lib/auth/guards";
import { assertSameOrigin, handleApiError, jsonOk, readJson } from "@/lib/http";
import { menuItemSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { toNumber } from "@/lib/utils";

export async function GET() {
  try {
    const context = await requireApiRestaurant();
    const items = await prisma.menuItem.findMany({
      where: { restaurantId: context.restaurant.id, isArchived: false },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return jsonOk({
      items: items.map((item) => ({ ...item, price: toNumber(item.price) })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireApiRestaurant();
    enforceRateLimit(`menu-write:${context.user.id}`, 60, 10 * 60_000);
    const body = menuItemSchema.parse(await readJson(request));

    const item = await prisma.menuItem.create({
      data: {
        restaurantId: context.restaurant.id,
        name: body.name,
        description: body.description || null,
        price: body.price,
        category: body.category,
        prepTimeMinutes: body.prepTimeMinutes,
        imageUrl: body.imageUrl || null,
        dietaryTags: body.dietaryTags,
        allergens: body.allergens,
        isAvailable: body.isAvailable,
      },
    });
    return jsonOk({ item: { ...item, price: toNumber(item.price) } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
