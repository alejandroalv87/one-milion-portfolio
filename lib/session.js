// Edge-safe session for the optional shared-password gate (HS256 JWT cookie).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "pt_session";

function secretKey() {
  const s = process.env.AUTH_SECRET || "";
  return new TextEncoder().encode(s);
}

export function gateEnabled() {
  return !!(process.env.SITE_PASSWORD && process.env.AUTH_SECRET);
}

export function sessionMaxAgeSeconds() {
  const days = Number(process.env.SESSION_DAYS || 30);
  return Math.max(1, days) * 24 * 60 * 60;
}

export async function createSessionToken() {
  return await new SignJWT({ ok: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds())
    .sign(secretKey());
}

export async function verifySessionToken(token) {
  if (!token || !process.env.AUTH_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAgeSeconds(),
  };
}
