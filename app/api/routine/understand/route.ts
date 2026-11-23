import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRoutine } from "@/lib/site-store";

export const maxDuration = 30;

// "Tell us about your skin" → the routine quiz answers, filled in by AI.
export async function POST(req: NextRequest) {
  const p = z.object({ text: z.string().min(5).max(600) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Tell us a little more" }, { status: 400 });
  const m = await import("@/lib/routine-ai");
  const answers = await m.aiUnderstand(p.data.text, await getRoutine()).catch((e) => (console.error("[routine-ai]", e), null));
  if (!answers) { console.error("[routine-ai]", m.lastErr, m.lastText); return NextResponse.json({ error: "Please answer the questions instead", ...(req.nextUrl.searchParams.has("debug") ? { d: m.lastErr, t: m.lastText } : {}) }, { status: 503 }); }
  return NextResponse.json({ answers });
}
