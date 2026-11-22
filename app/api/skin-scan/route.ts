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

const img = z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(6_000_000);
const bodySchema = z.object({ image: img, sides: z.array(img.max(2_500_000)).max(2).default([]) });

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

  const extra = parsed.data.sides.map((u) => u.match(/^data:(image\/\w+);base64,(.+)$/)!).map(([, m, d]) => ({ type: "image" as const, source: { type: "base64" as const, media_type: m, data: d } }));
  const types = cfg.skinTypes.map((s) => s.id);
  const concerns = cfg.concernOptions.map((c) => c.label);
  const prompt = `You are a cosmetic skin assessor working alongside pharmacists in a beauty and parapharmacy shop. Assess this selfie${extra.length ? ` (photo 1 is the front of the face; photo${extra.length > 1 ? "s 2 and 3 are" : " 2 is"} the same face turned to the side, from a guided 3D scan: use them for the cheeks, jawline and sides of the nose, which a front photo shows poorly)` : ""} the way a cosmetic dermatologist does a visual skin exam, but stay strictly cosmetic: no diagnoses, no medical treatment, never guess age, ethnicity, gender or identity.

Method (think through it, but output only the JSON):
1. Photo quality first: is a face clearly visible, in focus, evenly lit, without heavy make-up or beauty filters? If not usable, return {"ok":false,"reason":"short tip to retake"}.
2. Look zone by zone: forehead, nose, cheeks, chin/jaw, under-eyes.
3. For each zone note only what is visible: shine/oil, dry or flaky patches, redness or flushing, visible pores, blackheads/whiteheads, inflamed spots, post-blemish marks, uneven tone or dark spots, fine lines, dullness.
4. Classify the overall skin type from the pattern (e.g. shine only on the T-zone = combination).
5. Rate how confident you are, given the photo (lighting, angle, resolution, make-up).
6. Red flags: anything that should be seen by a doctor rather than treated with cosmetics (a mole or spot that looks irregular, bleeding, very inflamed or widespread deep spots, open sores, swelling, signs of infection, a rash with blisters). If present, list them plainly and gently.

Return only JSON:
{"ok":true,
 "skinType": one of ${JSON.stringify(types)},
 "concerns": up to 3 of ${JSON.stringify(concerns)}, most important first,
 "sensitive": true|false (visible redness or irritation),
 "zones": [{"zone":"forehead|nose|cheeks|chin|under-eyes","note":"short visible finding"}] (only zones with something worth saying, max 5),
 "observations": ["3 to 5 short plain-English observations, e.g. 'some shine on the forehead and nose'"],
 "confidence": "high"|"medium"|"low",
 "photoTips": "one short tip to get a better reading next time, or empty",
 "redFlags": ["plain-language reasons to see a doctor or pharmacist, empty if none"],
 "advice": "one friendly sentence; if redFlags is not empty, recommend seeing a doctor or pharmacist before starting new products"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 1200,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mediaType, data } }, ...extra, { type: "text", text: prompt }] }],
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
  let a: { ok: boolean; reason?: string; skinType?: string; concerns?: string[]; sensitive?: boolean; observations?: string[]; advice?: string; zones?: { zone: string; note: string }[]; confidence?: string; photoTips?: string; redFlags?: string[] };
  try {
    a = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    return NextResponse.json({ error: "We couldn't read that photo. Try again in daylight, facing the camera." }, { status: 422 });
  }
  if (!a.ok) return NextResponse.json({ error: "We couldn't see your face clearly. Take a selfie facing a window, face in the oval, no filters." }, { status: 422 });

  const answers = {
    skinType: types.includes(a.skinType ?? "") ? a.skinType! : "normal",
    concerns: (a.concerns ?? []).filter((c) => concerns.includes(c)).slice(0, 3),
    goals: [], sensitive: !!a.sensitive, budget: "any" as const, length: "full" as const,
  };
  const live = await liveProducts();
  const steps = buildRoutine(cfg, answers, toCards(live.list)).map(({ step, picks }) => ({ id: step.id, name: step.name, time: step.time, tip: step.tip, picks }));
  return NextResponse.json({ analysis: { skinType: cfg.skinTypes.find((s) => s.id === answers.skinType)?.label, concerns: answers.concerns, sensitive: answers.sensitive, observations: (a.observations ?? []).slice(0, 5), advice: a.advice ?? "", zones: (a.zones ?? []).slice(0, 5), confidence: ["high", "medium", "low"].includes(a.confidence ?? "") ? a.confidence : "medium", photoTips: a.photoTips ?? "", redFlags: (a.redFlags ?? []).slice(0, 4) }, steps });
}
