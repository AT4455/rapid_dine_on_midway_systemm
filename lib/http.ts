import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, message: string, code = "request_error", details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(message: string, status = 400, code = "request_error", details?: unknown) {
  return NextResponse.json({ ok: false, error: { message, code, details } }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof HttpError) {
    return jsonError(error.message, error.status, error.code, error.details);
  }
  if (error instanceof ZodError) {
    return jsonError("Please check the highlighted fields.", 422, "validation_error", error.flatten());
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return jsonError("That record already exists.", 409, "duplicate");
    }
    if (error.code === "P2025") {
      return jsonError("That record could not be found.", 404, "not_found");
    }
    console.error("Prisma error", error.code, error.message);
    return jsonError("The database could not complete that request.", 500, "database_error");
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error("Database connection error", error.message);
    return jsonError(
      "The database is not reachable. Check DATABASE_URL and that MySQL is running.",
      503,
      "database_unavailable",
    );
  }
  console.error("Unhandled API error", error);
  return jsonError("Something went wrong. Please try again.", 500, "server_error");
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return; // non-browser clients / same-origin GET
  const host = request.headers.get("host");
  try {
    const originUrl = new URL(origin);
    if (originUrl.host === host) return;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl && new URL(appUrl).host === originUrl.host) return;
  } catch {
    /* fall through */
  }
  throw new HttpError(403, "Cross-site request blocked.", "csrf_blocked");
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.", "invalid_json");
  }
}

export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}
