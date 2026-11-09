import { NextResponse } from "next/server";
import { getFxRates } from "@/lib/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const p = req.nextUrl.searchParams;
  const base = p.get("base") || "USD";
  const ccy = (p.get("ccy") || "").split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const data = await getFxRates(base, ccy);
    return NextResponse.json({ base: base.toUpperCase(), data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 502 });
  }
}
