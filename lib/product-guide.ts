import "server-only";

import { db } from "@/lib/db";

// "How to use" guide written once per product by AI from the product's OWN details (name, brand,
// category, description, directions, ingredients), then stored and reused: static content, not
// generated on each visit. Anything the AI can't support from those details is left out.
export type Guide = { steps: string[]; when: string; goodFor: string; cautions: string[]; source?: string; v: 2 };

const K = (slug: string) => `guide:v2:${slug}`;

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

1. Search the web for the MANUFACTURER'S OFFICIAL directions for EXACTLY this product (same brand, same product, same variant): the brand's own website first, otherwise a pharmacy or retailer page that reproduces the pack's directions. Ignore pages about other products of the range.
2. Write the guide from those official directions (and the maker's directions above if given). Reword them into clear, friendly steps; don't add steps, amounts, frequencies, ages or claims the maker doesn't give. Only fill gaps with what is universally true for this exact type of product.
3. Plain English, no brand praise, no medical claims.

Reply with ONLY this JSON as your final answer:
{"steps": [3 to 6 short steps in order of use, one sentence each],
 "when": "when and how often, as the maker says (short)",
 "goodFor": "one short sentence: what it's for / who it's for, per the maker",
 "cautions": [0 to 3 warnings from the maker's label, e.g. avoid eyes, patch test, keep out of reach of children, age limits],
 "source": "domain of the official page you used, e.g. laroche-posay.com, or empty if you found none"}
If you can't find reliable directions for this exact product and the details above are too thin, reply {"none": true}.`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_GUIDE_MODEL || "claude-sonnet-5-5", max_tokens: 3000, tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }], messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(55_000),
  }).catch(() => null);
  if (!r?.ok) { if (r) console.error("[guide]", r.status, (await r.text().catch(() => "")).slice(0, 300)); return null; } // try again another time
  const j = (await r.json().catch(() => ({}))) as { content?: { type: string; text?: string }[] };
  const texts = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "");
  const text = texts[texts.length - 1] ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  let g: Guide | { none: true } = { none: true };
  try {
    const o = JSON.parse(m?.[0] ?? "{}");
    if (!o.none && Array.isArray(o.steps) && o.steps.length) {
      g = { v: 2, steps: o.steps.map(String).slice(0, 6).map((s: string) => s.slice(0, 260)), when: String(o.when ?? "").slice(0, 140), goodFor: String(o.goodFor ?? "").slice(0, 220), cautions: (Array.isArray(o.cautions) ? o.cautions : []).map(String).slice(0, 3).map((s: string) => s.slice(0, 220)), source: String(o.source ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].slice(0, 60) };
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
