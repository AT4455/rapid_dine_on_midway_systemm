import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin, clientIp, handleApiError, HttpError, jsonOk, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(`login:${clientIp(request)}`, 12, 5 * 60_000);
    const body = loginSchema.parse(await readJson(request));

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
    if (!user || !valid) {
      throw new HttpError(401, "Email or password is incorrect.", "invalid_credentials");
    }
    if (body.role && user.role !== body.role) {
      throw new HttpError(
        403,
        user.role === "CUSTOMER"
          ? "This is a traveller account. Use the traveller sign-in."
          : "This is a restaurant partner account. Use the partner sign-in.",
        "wrong_role",
      );
    }

    await createSessionCookie({
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    });

    return jsonOk({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, isDemo: user.isDemo },
      redirectTo: user.role === "CUSTOMER" ? "/customer/dashboard" : "/restaurant/dashboard",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
