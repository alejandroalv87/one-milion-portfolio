import { NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_API_PREFIX = "/api/auth/";

export async function middleware(req) {
  // Gate is OFF unless BOTH SITE_PASSWORD and AUTH_SECRET are set.
  if (!process.env.SITE_PASSWORD || !process.env.AUTH_SECRET) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith(PUBLIC_API_PREFIX)
  ) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|ico|css|js|woff2?)$).*)"],
};
