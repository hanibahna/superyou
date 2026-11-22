import { limited } from "@/lib/ratelimit";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getGrowth } from "@/lib/growth-store";
import { toCards } from "@/lib/listing";
import { liveProducts } from "@/lib/pricing";
import { buildRoutine } from "@/lib/routine";
import { getRoutine } from "@/lib/site-store";
import { anthropicKey } from "@/lib/extras";

// AI skin scan: a selfie is read once by an AI vision model (photo never stored), the result
// is mapped to the routine finder's answers, and a routine is built from products in stock.
// Needs ANTHROPIC_API_KEY (optional ANTHROPIC_MODEL). Cosmetic guidance only, not a diagnosis.
export const maxDuration = 60;

const bodySchema = z.object({ image: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(6_000_000) });

export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "skinscan", 20);
  if (tooMany) return tooMany;
  const [g, cfg] = await Promise.all([getGrowth(), getRoutine()]);
  if (!g.skinScan.enabled) return NextResponse.json({ error: "Skin scan is switched off" }, { status: 404 });
  const key = await anthropicKey();
  if (!key) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please upload a JPG or PNG photo under 4 MB" }, { status: 400 });
  const [, mediaType, data] = parsed.data.image.match(/^data:(image\/\w+);base64,(.+)$/)!;

  const types = cfg.skinTypes.map((s) => s.id);
  const concerns = cfg.concernOptions.map((c) => c.label);
  const prompt = `You are a cosmetic skincare assistant for a pharmacy e-shop. Look at this face photo and describe only what is visible about the skin, for choosing over-the-counter skincare. Do not diagnose medical conditions, do not guess age, ethnicity or identity.
If the photo is not a clear face photo, return {"ok":false,"reason":"..."}.
Otherwise return only JSON: {"ok":true,"skinType": one of ${JSON.stringify(types)}, "concerns": up to 3 of ${JSON.stringify(concerns)}, "sensitive": true|false (visible redness/irritation), "observations": ["3 to 5 short plain-English observations about visible skin, e.g. 'some shine on the forehead and nose'"], "advice": "one sentence, suggest seeing a pharmacist or dermatologist for anything that looks painful, spreading or unusual"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      temperature: 0,
      max_tokens: 700,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mediaType, data } }, { type: "text", text: prompt }] }],
    }),
    signal: AbortSignal.timeout(55_000),
  }).catch((e) => (console.error("skin-scan: AI request failed", e), null));
  if (!res?.ok) {
    if (res) console.error("skin-scan: AI error", res.status, (await res.text().catch(() => "")).slice(0, 500));
    // A wrong or expired key reads to the shopper as "not switched on", not as a broken scan.
    if (res && (res.status === 401 || res.status === 403)) return NextResponse.json({ error: "not_configured" }, { status: 503 });
    return NextResponse.json({ error: "The skin scan is busy, please try again or use the quiz" }, { status: 502 });
  }
  const out = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = out.content?.find((c) => c.type === "text")?.text ?? "";
  let a: { ok: boolean; reason?: string; skinType?: string; concerns?: string[]; sensitive?: boolean; observations?: string[]; advice?: string };
  try {
    a = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    return NextResponse.json({ error: "We couldn't read that photo. Try again in daylight, facing the camera." }, { status: 422 });
  }
  if (!a.ok) return NextResponse.json({ error: a.reason || "Please use a clear photo of your face in daylight." }, { status: 422 });

  const answers = {
    skinType: types.includes(a.skinType ?? "") ? a.skinType! : "normal",
    concerns: (a.concerns ?? []).filter((c) => concerns.includes(c)).slice(0, 3),
    goals: [], sensitive: !!a.sensitive, budget: "any" as const, length: "full" as const,
  };
  const live = await liveProducts();
  const steps = buildRoutine(cfg, answers, toCards(live.list)).map(({ step, picks }) => ({ id: step.id, name: step.name, time: step.time, tip: step.tip, picks }));
  return NextResponse.json({ analysis: { skinType: cfg.skinTypes.find((s) => s.id === answers.skinType)?.label, concerns: answers.concerns, sensitive: answers.sensitive, observations: (a.observations ?? []).slice(0, 5), advice: a.advice ?? "" }, steps });
}
