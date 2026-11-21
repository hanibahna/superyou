import { getLang } from "@/lib/i18n-server";
import { translateDeep } from "@/lib/translate";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { toCards } from "@/lib/listing";
import { liveProducts } from "@/lib/pricing";
import { buildRoutine } from "@/lib/routine";
import { getRoutine } from "@/lib/site-store";

const schema = z.object({
  skinType: z.string().max(40),
  concerns: z.array(z.string().max(80)).max(10),
  goals: z.array(z.string().max(80)).max(10),
  sensitive: z.boolean(),
  budget: z.enum(["any", "low", "mid", "high"]),
  length: z.enum(["essential", "full"]),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
  const [cfg, live] = await Promise.all([getRoutine(), liveProducts()]);
  if (!cfg.enabled) return NextResponse.json({ error: "The routine finder is switched off" }, { status: 404 });
  const cards = toCards(live.list); // one entry per item (cheapest size)
  const steps = buildRoutine(cfg, parsed.data, cards).map(({ step, picks }) => ({
    id: step.id, name: step.name, time: step.time, tip: step.tip, picks,
  }));
  return NextResponse.json({ steps: await translateDeep(steps, await getLang(), ["name", "tip"]) });
}
