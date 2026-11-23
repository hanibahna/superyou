import "server-only";

import { db } from "@/lib/db";

// "How to use" guide written once per product by AI from the product's OWN details (name, brand,
// category, description, directions, ingredients), then stored and reused: static content, not
// generated on each visit. Anything the AI can't support from those details is left out.
export type Guide = { steps: string[]; when: string; goodFor: string; cautions: string[]; v: 1 };

const K = (slug: string) => `guide:v1:${slug}`;

export async function getGuide(slug: string): Promise<Guide | null> {
  const raw = await db.cmd<string | null>(["GET", K(slug)]).catch(() => null);
  if (!raw) return null;
  const g = JSON.parse(raw) as Guide | { none: true };
  return "none" in g ? null : g;
}

export const hasGuide = async (slug: string) => !!(await db.cmd<number>(["EXISTS", K(slug)]).catch(() => 0));

export async function makeGuide(slug: string, p: { brand: string; name: string; category: string; description: string; howToUse: string; ingredients: string }): Promise<Guide | null> {
  const { anthropicKey } = await import("@/lib/extras");
  const key = await anthropicKey();
  if (!key) return null;
  const info = [`Product: ${p.brand} ${p.name}`, `Category: ${p.category}`, p.description && `Description: ${p.description.slice(0, 2500)}`, p.howToUse && `Directions from the maker: ${p.howToUse.slice(0, 1500)}`, p.ingredients && `Ingredients: ${p.ingredients.slice(0, 800)}`].filter(Boolean).join("\n");
  const prompt = `You write the "How to use" box for one product on SuperYou, a beauty and parapharmacy shop in Lebanon.

${info}

Write a guide for EXACTLY this product, based only on the details above and what is generally true for this exact type of product. Never invent claims, results, ingredients, doses or ages that the details don't support. If the maker's directions are given, follow them. Plain, friendly English. No brand praise, no medical claims.

Reply with JSON only:
{"steps": [3 to 5 short steps, each one sentence, in order of use],
 "when": "when to use it, e.g. 'Morning and evening' or 'Once a day with a meal' (short)",
 "goodFor": "one short sentence: who or what it's for, from the details",
 "cautions": [0 to 3 short safety notes that really apply to this product, e.g. patch test, avoid eyes, SPF after acids, keep out of reach of children, not for pregnancy only if the details say so]}
If the details are too thin to write accurate steps, reply {"none": true}.`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_GUIDE_MODEL || "claude-sonnet-5-5", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(40_000),
  }).catch(() => null);
  if (!r?.ok) return null; // try again another time
  const j = (await r.json().catch(() => ({}))) as { content?: { text?: string }[] };
  const text = (j.content ?? []).map((c) => c.text ?? "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  let g: Guide | { none: true } = { none: true };
  try {
    const o = JSON.parse(m?.[0] ?? "{}");
    if (!o.none && Array.isArray(o.steps) && o.steps.length) {
      g = { v: 1, steps: o.steps.map(String).slice(0, 5).map((s: string) => s.slice(0, 240)), when: String(o.when ?? "").slice(0, 120), goodFor: String(o.goodFor ?? "").slice(0, 200), cautions: (Array.isArray(o.cautions) ? o.cautions : []).map(String).slice(0, 3).map((s: string) => s.slice(0, 200)) };
    }
  } catch { /* keep none */ }
  await db.cmd(["SET", K(slug), JSON.stringify(g)]).catch(() => {});
  return "none" in g ? null : g;
}

/** Daily: write guides for in-stock products that don't have one yet, bestsellers first. */
export async function prefillGuides(limit = 60) {
  const { liveProducts } = await import("@/lib/pricing");
  const { getProductDetail } = await import("@/lib/catalog");
  const list = (await liveProducts()).list
    .filter((p) => p.inStock && p.status !== "draft")
    .sort((a, b) => Number(b.tags.includes("favorite")) - Number(a.tags.includes("favorite")) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
  const seen = new Set<string>();
  let done = 0;
  for (const p of list) {
    if (done >= limit) break;
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    if (await hasGuide(p.slug)) continue;
    const d = await getProductDetail(p.id);
    if (!d) continue;
    await makeGuide(p.slug, { brand: d.brand, name: d.name, category: d.category, description: d.description, howToUse: d.howToUse, ingredients: d.ingredients });
    done++;
  }
  return done;
}
