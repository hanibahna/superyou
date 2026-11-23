import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { limited } from "@/lib/ratelimit";
import { checkIn } from "@/lib/game";
import { getGrowth } from "@/lib/growth-store";
import { DEFAULT_TIPS } from "@/lib/growth";

// App: daily pharmacist tip. Opening it once a day builds a streak; a full streak earns Club points (members only).

export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "checkin", 20);
  if (tooMany) return tooMany;
  const p = z.object({ phone: z.string().max(30).optional().default("") }).safeParse(await req.json().catch(() => ({})));
  const g = await getGrowth();
  const day = Math.floor((Date.now() + 2 * 3600_000) / 864e5);
  const tips = g.game.checkin.tips.length ? g.game.checkin.tips : DEFAULT_TIPS;
  const tip = tips[day % tips.length];
  if (!g.game.enabled || !g.game.checkin.enabled) return NextResponse.json({ tip, streak: null });
  const st = p.success && p.data.phone ? await checkIn(p.data.phone) : null;
  return NextResponse.json({ tip, streak: st, days: g.game.checkin.days, points: g.game.checkin.points });
}
