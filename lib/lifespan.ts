import "server-only";

import { db } from "@/lib/db";
import { everyForDays, type Every } from "@/lib/every";

// How long each product lasts with normal use, judged by AI from its name, size and category, and
// stored per product page. It sets the subscription frequency (a toothbrush every 3 months, a
// 30-capsule supplement monthly, a 50 ml cream every 2 months), the restock reminder timing, and
// whether a subscription makes sense at all (not for a perfume, a device or make-up kept for years).
export type Life = { days: number; every: Every | 0; basis: string; by: "ai" | "admin"; v: 1 | 2 | 3 };
const H = "life";

export async function getLife(slug: string): Promise<Life | null> {
  const raw = await db.cmd<string | null>(["HGET", H, slug]).catch(() => null);
  return raw ? (JSON.parse(raw) as Life) : null;
}
export async function getLives(slugs: string[]): Promise<Map<string, Life>> {
  const out = new Map<string, Life>();
  const uniq = [...new Set(slugs)];
  for (let i = 0; i < uniq.length; i += 500) {
    const part = uniq.slice(i, i + 500);
    const vals = await db.cmd<(string | null)[]>(["HMGET", H, ...part]).catch(() => [] as (string | null)[]);
    (vals ?? []).forEach((v, n) => v && out.set(part[n], JSON.parse(v)));
  }
  return out;
}
export async function setLife(slug: string, l: Life) { await db.cmd(["HSET", H, slug, JSON.stringify(l)]); }
export async function lifeStats() {
  const all = await db.cmd<Record<string, string> | string[]>(["HGETALL", H]).catch(() => [] as string[]);
  const vals: string[] = Array.isArray(all) ? all.filter((_, i) => i % 2 === 1) : Object.values(all ?? {});
  const by: Record<string, number> = {};
  for (const v of vals) { const l = JSON.parse(v) as Life; if (l.by === "ai" && (l.v ?? 1) < 3) continue; const k = l.every ? `${l.every}` : "no"; by[k] = (by[k] ?? 0) + 1; }
  return { total: Object.values(by).reduce((a, n) => a + n, 0), by };
}

type Item = { slug: string; brand: string; name: string; size?: string; category: string };

/** One AI call judges up to 40 products. The AI gives the measurable facts (pack size, amount per use,
 * uses per week); the days are worked out here, so every estimate follows the same arithmetic. */
async function judge(items: Item[]): Promise<Map<string, Omit<Life, "by" | "v">>> {
  const out = new Map<string, Omit<Life, "by" | "v">>();
  const { anthropicKey } = await import("@/lib/extras");
  const key = await anthropicKey();
  if (!key || !items.length) return out;
  const list = items.map((p, i) => `${i + 1}. ${p.brand} ${p.name}${p.size ? ` | ${p.size}` : ""} | ${p.category}`).join("\n");
  const prompt = `For a pharmacy and beauty shop's "Subscribe & save", work out how fast one person uses up each product below, as directed by the maker, for one typical user.

For each product give:
- "qty": how much is in the pack, as a number (from the name or size; if missing, the usual size for that exact product)
- "unit": "ml", "g" or "count" (tablets, capsules, sachets, pieces, brushes, blades, nappies, strips, lenses…)
- "per": amount used each time, in the same unit
- "week": how many times it is used per week (daily = 7, twice daily = 14, twice a week = 2)
- "sub": false when a repeat delivery makes no sense: fragrances and body mists, devices and tools (hair dryers, epilators, electric toothbrush handles, tweezers, mirrors), gift sets and coffrets, colour make-up bought for variety (lipstick, blush, eyeshadow, nail colour), false lashes, accessories, medical equipment
- "typical": your own sense, from experience, of how many days one pack really lasts a regular user (people often say "a tube lasts me two months")
- "basis": at most 8 words, e.g. "3 ml per mask, twice a week"

Typical amounts per use: face cream or moisturiser 0.5 ml twice daily; eye cream 0.1 ml twice daily; face serum 0.3 ml once or twice daily; face oil 0.15 ml daily; face cleanser 1.5 ml twice daily; micellar water 3 ml twice daily; toner 2 ml twice daily; clay or face mask 3 ml, 1–2 times a week; sheet mask 1 per use, 2 a week; exfoliant or peel 2 ml, 2–3 times a week; face sunscreen 1.2 ml daily (reapply = 2 a day if it's a sun-care product for outdoors); body lotion 6 ml daily; body wash or shower gel 10 ml daily; shampoo 8 ml 3–4 times a week; conditioner 8 ml 3–4 times a week; hair mask 15 ml once a week; leave-in or serum for hair 1 ml 3–4 times a week; roll-on deodorant 0.8 ml daily; spray deodorant 4 ml daily; stick deodorant 0.6 g daily; dry shampoo 6 ml (spray) 2 times a week; hair spray 3 ml daily; baby wash or baby shampoo 4 ml daily; baby lotion 3 ml daily; nappy cream 2 g 6 times a day; toothpaste 1 g twice daily; mouthwash 20 ml twice daily; manual toothbrush or brush head: count, per 1, week 1/13 (one every 3 months); razor blade or cartridge: per 1, week 1; hand cream 1 ml 3 times a day; lip balm 0.05 g 4 times a day; intimate wash 5 ml daily; baby nappies per 1, week 42; baby wipes per 1, week 35; infant formula 30 g per feed, 42 feeds a week (check the age stage); contact lens solution 10 ml daily; tablets, capsules, sachets, gummies, drops: the maker's daily dose × 7; foundation 0.5 ml daily; concealer 0.1 ml daily; mascara: count 1, per 1, week 7/90 (replace every 3 months); hair dye: per 1 kit, week 1/6.

Reply with JSON only, one entry per product, in order:
[{"i":1,"qty":50,"unit":"ml","per":3,"week":2,"typical":60,"sub":true,"basis":"3 ml per mask, twice a week"}]

${list}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_LIFESPAN_MODEL || "claude-sonnet-5-5", max_tokens: 8000, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(150_000),
  }).catch(() => null);
  if (!r?.ok) { if (r) console.error("[lifespan]", r.status, (await r.text().catch(() => "")).slice(0, 200)); return out; }
  const j = (await r.json().catch(() => ({}))) as { content?: { text?: string }[] };
  const text = (j.content ?? []).map((c) => c.text ?? "").join("");
  let arr: { i: number; qty: number; unit: string; per: number; week: number; typical?: number; sub: boolean; basis?: string }[] = [];
  try { arr = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? "[]"); } catch { return out; }
  for (const a of arr) {
    const p = items[(a.i ?? 0) - 1];
    const qty = Number(a.qty), per = Number(a.per), week = Number(a.week);
    if (!p || !(qty > 0) || !(per > 0) || !(week > 0)) continue;
    let days = qty / ((per * week) / 7);
    // Cross-check with experience: when the arithmetic and the usual answer disagree by more than 1.5×,
    // take the middle (geometric mean), so a wrong amount per use can't swing the plan too far.
    const typ = Number(a.typical);
    if (typ > 0 && (days / typ > 1.5 || typ / days > 1.5)) days = Math.sqrt(days * typ);
    days = Math.round(Math.min(3650, Math.max(1, days)));
    out.set(p.slug, { days, every: a.sub && days <= 400 ? everyForDays(days) : 0, basis: `${String(a.basis ?? "").slice(0, 60)} (${qty} ${a.unit})`.slice(0, 80) });
  }
  return out;
}

/** Fill the database: products without an estimate yet, best-sellers first. `calls` AI calls, `parallel` at a time. */
export async function buildLifespans(calls = 10, parallel = 5, match = "") {
  const { liveProducts } = await import("@/lib/pricing");
  const list = (await liveProducts()).list
    .filter((p) => p.status !== "draft")
    .sort((a, b) => Number(b.inStock) - Number(a.inStock) || Number(b.tags.includes("favorite")) - Number(a.tags.includes("favorite")) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
  const bySlug = new Map<string, Item>();
  for (const p of list) if (!bySlug.has(p.slug)) bySlug.set(p.slug, { slug: p.slug, brand: p.brand, name: p.name, size: p.size, category: p.category });
  const have = await getLives([...bySlug.keys()]);
  // Redo the first-pass estimates (v1, a guessed total); keep anything corrected by hand.
  // With `match`: re-estimate the products whose name contains it (corrections by hand are kept).
  const m = match.toLowerCase().trim();
  const todo = [...bySlug.values()].filter((p) => { const l = have.get(p.slug); return m ? `${p.brand} ${p.name}`.toLowerCase().includes(m) && l?.by !== "admin" : !l || (l.by === "ai" && (l.v ?? 1) < 3); });
  const batches: Item[][] = [];
  for (let i = 0; i < todo.length && batches.length < calls; i += 40) batches.push(todo.slice(i, i + 40));
  let saved = 0;
  for (let i = 0; i < batches.length; i += parallel) {
    const res = await Promise.all(batches.slice(i, i + parallel).map(judge));
    const cmds: string[] = [];
    for (const m of res) for (const [slug, l] of m) { cmds.push(slug, JSON.stringify({ ...l, by: "ai", v: 3 } satisfies Life)); saved++; }
    if (cmds.length) await db.cmd(["HSET", H, ...cmds]);
  }
  return { saved, remaining: Math.max(0, todo.length - saved), total: bySlug.size };
}
