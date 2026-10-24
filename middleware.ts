import { NextResponse, type NextRequest } from "next/server";
import { config as appConfig } from "@/lib/config";
import { verifySessionToken } from "@/lib/auth/jwt";

/**
 * Edge guard for page routes only. Role is still re-checked against MySQL in
 * every protected layout and every API route — the JWT is a fast gate, not the
 * source of truth.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(appConfig.auth.cookieName)?.value;
  const session = await verifySessionToken(token);
  const { pathname, search } = request.nextUrl;

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/customer") && session.role !== "CUSTOMER") {
    const url = request.nextUrl.clone();
    url.pathname = "/restaurant/dashboard";
    url.search = "?denied=customer";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/restaurant") && session.role !== "RESTAURANT") {
    const url = request.nextUrl.clone();
    url.pathname = "/customer/dashboard";
    url.search = "?denied=restaurant";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/customer/:path*", "/restaurant/:path*"],
};
