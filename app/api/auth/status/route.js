import { NextResponse } from "next/server";
import { gateEnabled } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ gated: gateEnabled() });
}
