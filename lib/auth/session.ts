import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { config } from "../config";
import { signSessionToken, verifySessionToken, type SessionPayload } from "./jwt";

export { verifySessionToken };

export function sessionCookieOptions() {
  return {
    name: config.auth.cookieName,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.isProduction,
    path: "/",
    maxAge: config.auth.sessionDays * 24 * 60 * 60,
  };
}

export async function createSessionCookie(payload: SessionPayload) {
  const token = await signSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieOptions().name, token, sessionCookieOptions());
  return token;
}

export async function destroySessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieOptions().name, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
}

export async function setSessionOnResponse(response: NextResponse, payload: SessionPayload) {
  const token = await signSessionToken(payload);
  response.cookies.set(sessionCookieOptions().name, token, sessionCookieOptions());
  return response;
}

export async function getSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(config.auth.cookieName)?.value ?? null;
}

export async function getSession(): Promise<SessionPayload | null> {
  return verifySessionToken(await getSessionToken());
}
