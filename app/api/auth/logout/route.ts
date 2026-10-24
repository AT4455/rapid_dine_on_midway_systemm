import { destroySessionCookie } from "@/lib/auth/session";
import { assertSameOrigin, handleApiError, jsonOk } from "@/lib/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await destroySessionCookie();
    return jsonOk({ signedOut: true });
  } catch (error) {
    return handleApiError(error);
  }
}
