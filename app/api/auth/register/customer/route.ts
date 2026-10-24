import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin, handleApiError, HttpError, jsonOk, readJson } from "@/lib/http";
import { customerRegisterSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/http";
import { slugify } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(`register:${clientIp(request)}`, 8, 10 * 60_000);
    const body = customerRegisterSchema.parse(await readJson(request));

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new HttpError(409, "An account with that email already exists.", "email_taken");

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        phone: body.phone,
        passwordHash,
        role: "CUSTOMER", // role is assigned on the server, never trusted from the browser
        customerProfile: {
          create: {
            homeCity: body.homeCity,
            dietaryPreferences: body.dietaryPreferences ?? [],
            allergies: body.allergies,
            defaultBudget: 500,
          },
        },
      },
    });

    await createSessionCookie({
      sub: user.id,
      role: "CUSTOMER",
      email: user.email,
      name: user.name,
    });

    return jsonOk({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
