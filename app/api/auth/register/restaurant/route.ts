import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin, clientIp, handleApiError, HttpError, jsonOk, readJson } from "@/lib/http";
import { restaurantRegisterSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { config } from "@/lib/config";
import { slugify } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(`register-restaurant:${clientIp(request)}`, 6, 10 * 60_000);
    const body = restaurantRegisterSchema.parse(await readJson(request));

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new HttpError(409, "An account with that email already exists.", "email_taken");

    const baseSlug = slugify(body.restaurantName) || "restaurant";
    let slug = baseSlug;
    for (let i = 0; i < 8; i++) {
      const clash = await prisma.restaurant.findUnique({ where: { slug } });
      if (!clash) break;
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const passwordHash = await hashPassword(body.password);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email,
          name: body.ownerName,
          phone: body.phone,
          passwordHash,
          role: "RESTAURANT", // server-assigned role
        },
      });
      const restaurant = await tx.restaurant.create({
        data: {
          name: body.restaurantName,
          slug,
          description: body.description,
          cuisine: body.cuisine,
          imageUrl: body.imageUrl || null,
          address: body.address,
          latitude: body.latitude,
          longitude: body.longitude,
          phone: body.phone,
          email: body.email,
          pickupInstructions: body.pickupInstructions,
          openingTime: body.openingTime,
          closingTime: body.closingTime,
          openDays: [0, 1, 2, 3, 4, 5, 6],
          capacityPerHour: body.capacityPerHour,
          // Demo mode auto-verifies so the hackathon flow is testable.
          verificationStatus: config.demoMode ? "VERIFIED" : "PENDING",
          memberships: { create: { userId: user.id, role: "OWNER" } },
        },
      });
      return { user, restaurant };
    });

    await createSessionCookie({
      sub: result.user.id,
      role: "RESTAURANT",
      email: result.user.email,
      name: result.user.name,
    });

    return jsonOk(
      {
        user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role },
        restaurant: { id: result.restaurant.id, name: result.restaurant.name, slug: result.restaurant.slug },
        verified: result.restaurant.verificationStatus === "VERIFIED",
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
