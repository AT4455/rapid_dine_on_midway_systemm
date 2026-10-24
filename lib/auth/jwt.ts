import { SignJWT, jwtVerify } from "jose";
import { config } from "../config";

export type SessionRole = "CUSTOMER" | "RESTAURANT";

export type SessionPayload = {
  sub: string;
  role: SessionRole;
  email: string;
  name: string;
};

const issuer = "rapiddine";
const audience = "rapiddine-app";

function secretKey() {
  return new TextEncoder().encode(config.auth.secret);
}

export async function signSessionToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${config.auth.sessionDays}d`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer, audience });
    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "CUSTOMER" && payload.role !== "RESTAURANT") ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      role: payload.role,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
}
