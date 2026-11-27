import { NextResponse } from "next/server";
import { bfPublic } from "@/lib/bf-public";

// Black Friday dates, today's spotlight and the doors (for the strip and the countdown on every page).
export async function GET() {
  const b = await bfPublic();
  const { fx, ...rest } = b;
  return NextResponse.json({ ...rest, fx: { strip: fx.strip, daily: fx.daily, confetti: fx.confetti, stamps: fx.stamps, stampPoints: fx.stamps ? fx.stampPoints : 0, stampBonus: fx.stamps ? fx.stampBonus : 0 } }, { headers: { "Cache-Control": "public, max-age=30" } });
}
