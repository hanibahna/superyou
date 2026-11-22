import { NextResponse, type NextRequest } from "next/server";
import { trackClick } from "@/lib/influencers";

// Counts a visit from an influencer's link (once per browser session).
export async function POST(req: NextRequest) {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  return NextResponse.json({ ok: code ? await trackClick(String(code)).catch(() => false) : false });
}
