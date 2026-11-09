import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE, gateEnabled } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function POST(req) {
  if (!gateEnabled()) {
    // No gate configured — nothing to log into.
    return NextResponse.json({ ok: true, open: true });
  }
  let password;
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!safeEqual(password, process.env.SITE_PASSWORD)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
