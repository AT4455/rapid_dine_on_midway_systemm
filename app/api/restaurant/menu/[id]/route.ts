import { prisma } from "@/lib/db";
import { requireApiRestaurant } from "@/lib/auth/guards";
import { assertSameOrigin, handleApiError, HttpError, jsonOk, readJson } from "@/lib/http";
import { menuItemUpdateSchema } from "@/lib/validation";
import { toNumber } from "@/lib/utils";

async function ownedItem(id: string, restaurantId: string) {
  const item = await prisma.menuItem.findFirst({ where: { id, restaurantId, isArchived: false } });
  if (!item) throw new HttpError(404, "Menu item not found.", "not_found");
  return item;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiRestaurant();
    const { id } = await context.params;
    await ownedItem(id, ctx.restaurant.id);
    const body = menuItemUpdateSchema.parse(await readJson(request));
    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.price !== undefined ? { price: body.price } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.prepTimeMinutes !== undefined ? { prepTimeMinutes: body.prepTimeMinutes } : {}),
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl || null } : {}),
        ...(body.dietaryTags !== undefined ? { dietaryTags: body.dietaryTags } : {}),
        ...(body.allergens !== undefined ? { allergens: body.allergens } : {}),
        ...(body.isAvailable !== undefined ? { isAvailable: body.isAvailable } : {}),
      },
    });
    return jsonOk({ item: { ...item, price: toNumber(item.price) } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiRestaurant();
    const { id } = await context.params;
    await ownedItem(id, ctx.restaurant.id);
    // Soft-archive to preserve historical order snapshots and foreign keys.
    const item = await prisma.menuItem.update({
      where: { id },
      data: { isArchived: true, isAvailable: false },
    });
    return jsonOk({ archived: true, item: { ...item, price: toNumber(item.price) } });
  } catch (error) {
    return handleApiError(error);
  }
}
