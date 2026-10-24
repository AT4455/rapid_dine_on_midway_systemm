import { prisma } from "@/lib/db";
import { config, demoAccounts } from "@/lib/config";
import { createSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin, clientIp, handleApiError, HttpError, jsonOk, readJson } from "@/lib/http";
import { demoLoginSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!config.demoMode) {
      throw new HttpError(403, "Demo login is disabled on this deployment.", "demo_disabled");
    }
    enforceRateLimit(`demo-login:${clientIp(request)}`, 20, 5 * 60_000);
    const body = demoLoginSchema.parse(await readJson(request));
    const account = body.role === "CUSTOMER" ? demoAccounts.customer : demoAccounts.restaurant;
    const user = await prisma.user.findUnique({ where: { email: account.email } });
    if (!user) {
      throw new HttpError(
        503,
        "Demo accounts are not seeded yet. Run `npm run db:seed` and try again.",
        "demo_not_seeded",
      );
    }
    await createSessionCookie({
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    });
    return jsonOk({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, isDemo: true },
      redirectTo: user.role === "CUSTOMER" ? "/customer/dashboard" : "/restaurant/dashboard",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
