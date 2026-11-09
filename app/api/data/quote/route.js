import { NextResponse } from "next/server";
import { getQuotes, getQuoteDetail } from "@/lib/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const p = req.nextUrl.searchParams;
  const batch = p.get("symbols");
  const single = p.get("symbol");
  if (!batch && !single) {
    return NextResponse.json({ error: "symbol(s) required" }, { status: 400 });
  }
  try {
    if (batch) {
      const data = await getQuotes(batch);
      return NextResponse.json({ data });
    }
    const one = await getQuoteDetail(single);
    return NextResponse.json({ data: one ? [one] : [] });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 502 });
  }
}
