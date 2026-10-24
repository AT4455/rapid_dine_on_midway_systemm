import { prisma } from "@/lib/db";
import { requireApiCustomer } from "@/lib/auth/guards";
import { assertSameOrigin, handleApiError, jsonOk, readJson } from "@/lib/http";
import { profileUpdateSchema } from "@/lib/validation";
import { parseJsonArray, toNumber } from "@/lib/utils";

export async function GET() {
  try {
    const user = await requireApiCustomer();
    const profile = await prisma.customerProfile.findUnique({ where: { userId: user.id } });
    return jsonOk({
      user,
      profile: profile
        ? {
            ...profile,
            dietaryPreferences: parseJsonArray(profile.dietaryPreferences),
            defaultBudget: toNumber(profile.defaultBudget),
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiCustomer();
    const body = profileUpdateSchema.parse(await readJson(request));
    if (body.name || body.phone) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(body.name ? { name: body.name } : {}),
          ...(body.phone ? { phone: body.phone } : {}),
        },
      });
    }
    const profile = await prisma.customerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        dietaryPreferences: body.dietaryPreferences ?? [],
        allergies: body.allergies,
        defaultBudget: body.defaultBudget ?? 500,
        homeCity: body.homeCity,
      },
      update: {
        ...(body.dietaryPreferences !== undefined ? { dietaryPreferences: body.dietaryPreferences } : {}),
        ...(body.allergies !== undefined ? { allergies: body.allergies } : {}),
        ...(body.defaultBudget !== undefined ? { defaultBudget: body.defaultBudget } : {}),
        ...(body.homeCity !== undefined ? { homeCity: body.homeCity } : {}),
      },
    });
    return jsonOk({
      profile: {
        ...profile,
        dietaryPreferences: parseJsonArray(profile.dietaryPreferences),
        defaultBudget: toNumber(profile.defaultBudget),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
