import { getLang } from "@/lib/i18n-server";
import { translateDeep } from "@/lib/translate";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { toCards } from "@/lib/listing";
import { liveProducts } from "@/lib/pricing";
import { buildRoutine } from "@/lib/routine";
import { getRoutine } from "@/lib/site-store";

export const maxDuration = 60;

const schema = z.object({
  skinType: z.string().max(40),
  concerns: z.array(z.string().max(80)).max(10),
  goals: z.array(z.string().max(80)).max(10),
  sensitive: z.boolean(),
  budget: z.enum(["any", "low", "mid", "high"]),
  length: z.enum(["essential", "full"]),
  about: z.string().max(600).optional(),
  pregnant: z.boolean().optional(),
  total: z.number().min(0).max(5000).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
  const [cfg, live] = await Promise.all([getRoutine(), liveProducts()]);
  if (!cfg.enabled) return NextResponse.json({ error: "The routine finder is switched off" }, { status: 404 });
  const cards = toCards(live.list); // one entry per item (cheapest size)
  // A wider shortlist per step for the AI to choose from; the rules' order is the fallback.
  const wide = buildRoutine({ ...cfg, alternatives: 7 }, parsed.data, cards);
  const { aiPlan } = await import("@/lib/routine-ai");
  const plan = await aiPlan(parsed.data, wide.map(({ step, picks }) => ({ id: step.id, name: step.name, time: step.time, cands: picks.map((p) => ({ slug: p.slug, name: p.name, brand: p.brand, price: p.price })) }))).catch(() => null);
  const n = cfg.alternatives + 1;
  const steps = wide.map(({ step, picks }) => {
    const ai = plan?.steps.find((s) => s.id === step.id);
    const bySlug = (s: string) => picks.find((p) => p.slug === s);
    const ordered = ai?.pick ? [bySlug(ai.pick)!, ...ai.alts.map(bySlug).filter((p): p is (typeof picks)[number] => !!p)] : picks;
    const rest = picks.filter((p) => !ordered.includes(p));
    return { id: step.id, name: step.name, time: step.time, tip: step.tip, why: ai?.why ?? "", picks: [...ordered, ...rest].slice(0, n) };
  });
  const { CLINIC, publicProcedure, treatmentsFor } = await import("@/lib/clinic");
  const words = cfg.concernOptions.filter((c) => parsed.data.concerns.includes(c.label)).flatMap((c) => [c.label, ...c.keywords]);
  const treatments = treatmentsFor({ concerns: words, sensitive: parsed.data.sensitive }).map(publicProcedure);
  const lang = await getLang();
  return NextResponse.json({
    ai: !!plan,
    summary: plan?.summary ?? "",
    notes: plan?.notes ?? [],
    steps: await translateDeep(steps, lang, ["name", "tip", "why"]),
    treatments,
    clinic: { partner: CLINIC.partner, mock: CLINIC.mock },
  });
}
