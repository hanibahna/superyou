import { fullName } from "@/lib/data/catalog";
import "server-only";

import type { RoutineAnswers, RoutineConfig } from "@/lib/routine";

// AI on top of the routine finder. The rules pick a shortlist of in-stock products per step; Claude
// chooses the best one for this person from that shortlist only (never anything else), says why in
// one line, checks clashes between actives and gives the order. If AI is off or fails, the rules'
// own choice stands.
type Cand = { slug: string; name: string; brand: string; price: number };
export type AiStep = { id: string; pick: string; alts: string[]; why: string };
export type AiPlan = { summary: string; notes: string[]; steps: AiStep[] };

export let lastErr = "";
export let lastText = "";
async function ask(prompt: string, max = 1200): Promise<string> {
  const { anthropicKey } = await import("@/lib/extras");
  const key = await anthropicKey();
  if (!key) return "";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: max, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(45_000),
  }).catch(() => null);
  if (!r?.ok) { lastErr = r ? `${r.status} ${(await r.text().catch(() => "")).slice(0, 300)}` : "no response"; return ""; }
  const j = (await r.json().catch(() => ({}))) as { content?: { text?: string }[] };
  const t = (j.content ?? []).map((c) => c.text ?? "").join("");
  lastErr = t ? "" : "empty"; lastText = t.slice(0, 500);
  return t;
}
const json = <T,>(t: string): T | null => { try { return JSON.parse(t.match(/\{[\s\S]*\}/)?.[0] ?? "") as T; } catch { return null; } };

export async function aiPlan(a: RoutineAnswers & { about?: string; pregnant?: boolean; total?: number }, steps: { id: string; name: string; time: string; cands: Cand[] }[]): Promise<AiPlan | null> {
  if (!steps.some((s) => s.cands.length)) return null;
  const shelf = steps.map((s) => `STEP ${s.id} (${s.name}, ${s.time}):\n${s.cands.map((c) => `- ${c.slug} | ${fullName(c.brand, c.name)} | $${c.price}`).join("\n") || "- (none in stock)"}`).join("\n\n");
  const prompt = `You are the skincare advisor of SuperYou, a beauty and parapharmacy shop in Lebanon. Build one routine for this customer.

Customer:
- Skin type: ${a.skinType}${a.sensitive ? ", reacts easily" : ""}
- Wants to work on: ${a.concerns.join(", ") || "nothing specific"}
- Hoped results: ${a.goals.join(", ") || "-"}
- Budget per product: ${a.budget}${a.total ? `; total budget about $${a.total}` : ""}
- Pregnant or breastfeeding: ${a.pregnant ? "yes" : "no / not said"}
${a.about ? `- In their words: "${a.about.slice(0, 400)}"` : ""}

Products in stock, by step (choose ONLY slugs from these lists):
${shelf}

Rules:
- For each step pick the single best slug for this customer, plus up to 2 alternatives from the same step list. Skip a step (pick "") only if nothing fits.
- Respect the budget; if a total is given, keep the sum of picks under it.
- Don't combine retinoids with exfoliating acids on the same night; don't pick retinoids or high-dose acids if pregnant or breastfeeding; favour gentle, fragrance-free products for reactive skin.
- "why": one short sentence, specific to this customer and this product (from its name), no medical claims.
- "summary": two short sentences on the routine's logic. "notes": 0 to 3 short practical notes (introduce actives one at a time, patch test, SPF daily, see a doctor for anything medical).

Reply with JSON only: {"summary": "...", "notes": ["..."], "steps": [{"id": "step id", "pick": "slug", "alts": ["slug"], "why": "..."}]}`;
  const out = json<AiPlan>(await ask(prompt, 4000));
  if (!out?.steps) return null;
  const valid = new Map(steps.map((s) => [s.id, new Set(s.cands.map((c) => c.slug))]));
  return {
    summary: String(out.summary ?? "").slice(0, 400),
    notes: (out.notes ?? []).map(String).slice(0, 3).map((n) => n.slice(0, 200)),
    steps: out.steps.filter((s) => valid.has(s.id)).map((s) => {
      const ok = valid.get(s.id)!;
      return { id: s.id, pick: ok.has(s.pick) ? s.pick : "", alts: (s.alts ?? []).filter((x) => ok.has(x) && x !== s.pick).slice(0, 2), why: String(s.why ?? "").slice(0, 220) };
    }),
  };
}

/** "Tell us about your skin" → quiz answers, limited to the options the quiz offers. */
export async function aiUnderstand(text: string, cfg: RoutineConfig) {
  const prompt = `A shopper describes their skin: "${text.slice(0, 600)}"

Map it to these quiz options. Use only the exact option ids/labels given.
Skin types (id): ${cfg.skinTypes.map((s) => `${s.id} (${s.label})`).join(", ")}
Concerns (label, up to 3): ${cfg.concernOptions.map((c) => c.label).join(" | ")}
Goals (label, up to 2): ${cfg.goals.map((g) => g.label).join(" | ")}

Reply with JSON only: {"skinType": "id or empty", "concerns": ["label"], "goals": ["label"], "sensitive": true/false, "pregnant": true/false, "budget": "any|low|mid|high"}
Only set pregnant true if they say they are pregnant or breastfeeding.`;
  const o = json<{ skinType?: string; concerns?: string[]; goals?: string[]; sensitive?: boolean; pregnant?: boolean; budget?: string }>(await ask(prompt, 1200));
  if (!o) return null;
  const types = new Set(cfg.skinTypes.map((s) => s.id)), cons = new Set(cfg.concernOptions.map((c) => c.label)), gls = new Set(cfg.goals.map((g) => g.label));
  return {
    skinType: types.has(o.skinType ?? "") ? o.skinType! : "",
    concerns: (o.concerns ?? []).filter((c) => cons.has(c)).slice(0, 3),
    goals: (o.goals ?? []).filter((g) => gls.has(g)).slice(0, 2),
    sensitive: !!o.sensitive,
    pregnant: !!o.pregnant,
    budget: (["any", "low", "mid", "high"] as const).find((b) => b === o.budget) ?? "any",
  };
}
