import { NextResponse } from "next/server";
import { getIncomeStatement } from "@/lib/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const p = req.nextUrl.searchParams;
  const symbol = p.get("symbol");
  const period = p.get("period") === "annual" ? "annual" : "quarter";
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  try {
    const data = await getIncomeStatement(symbol, period);
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 502 });
  }
}
