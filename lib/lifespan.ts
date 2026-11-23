import "server-only";

import { db } from "@/lib/db";
import { everyForDays, type Every } from "@/lib/every";

// How long each product lasts with normal use, judged by AI from its name, size and category, and
// stored per product page. It sets the subscription frequency (a toothbrush every 3 months, a
// 30-capsule supplement monthly, a 50 ml cream every 2 months), the restock reminder timing, and
// whether a subscription makes sense at all (not for a perfume, a device or make-up kept for years).
export type Life = { days: number; every: Every | 0; basis: string; by: "ai" | "admin"; v: 1 };
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
  for (const v of vals) { const l = JSON.parse(v) as Life; const k = l.every ? `${l.every}` : "no"; by[k] = (by[k] ?? 0) + 1; }
  return { total: vals.length, by };
}

type Item = { slug: string; brand: string; name: string; size?: string; category: string };

/** One AI call judges up to 40 products. */
async function judge(items: Item[]): Promise<Map<string, Omit<Life, "by" | "v">>> {
  const out = new Map<string, Omit<Life, "by" | "v">>();
  const { anthropicKey } = await import("@/lib/extras");
  const key = await anthropicKey();
  if (!key || !items.length) return out;
  const list = items.map((p, i) => `${i + 1}. ${p.brand} ${p.name}${p.size ? ` | ${p.size}` : ""} | ${p.category}`).join("\n");
  const prompt = `You run a pharmacy and beauty shop's "Subscribe & save". For each product below, estimate how many DAYS one unit lasts for one person using it as directed with normal daily use (or as typically used for its kind), from the product type and the size or count in the name.

Guidance: face cream 50 ml ≈ 60 days; serum 30 ml ≈ 60 days; cleanser 200 ml ≈ 75 days; shampoo 250 ml ≈ 45 days; body lotion 400 ml ≈ 45 days; sunscreen 50 ml daily face ≈ 30 days; deodorant ≈ 45 days; toothpaste 75 ml ≈ 30 days; manual toothbrush or brush heads ≈ 90 days per brush; razor blades ≈ 7 days each; supplements = count ÷ daily dose (e.g. 60 capsules at 2 a day = 30 days); nappies/diapers = count ÷ ~6 a day; infant formula 400 g ≈ 7 days; contact lens solution ≈ 30 days; mascara ≈ 90 days; foundation 30 ml ≈ 90 days; lipstick ≈ 180 days.

Set "sub" to false when a repeat delivery makes no sense: fragrances, devices and tools (hair dryers, epilators, electric toothbrush handles, tweezers, mirrors), gift sets and coffrets, make-up palettes and colour cosmetics bought for variety, accessories, medical equipment, and anything lasting over 9 months.

Reply with JSON only, one entry per product, in order:
[{"i":1,"days":60,"sub":true,"basis":"50 ml, twice daily"}]
"basis" = at most 8 words explaining the estimate.

${list}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_TRANSLATE_MODEL || "claude-haiku-5-5", max_tokens: 6000, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(90_000),
  }).catch(() => null);
  if (!r?.ok) { if (r) console.error("[lifespan]", r.status, (await r.text().catch(() => "")).slice(0, 200)); return out; }
  const j = (await r.json().catch(() => ({}))) as { content?: { text?: string }[] };
  const text = (j.content ?? []).map((c) => c.text ?? "").join("");
  let arr: { i: number; days: number; sub: boolean; basis?: string }[] = [];
  try { arr = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? "[]"); } catch { return out; }
  for (const a of arr) {
    const p = items[(a.i ?? 0) - 1];
    const days = Math.round(Number(a.days));
    if (!p || !Number.isFinite(days) || days < 1 || days > 3650) continue;
    out.set(p.slug, { days, every: a.sub && days <= 270 ? everyForDays(days) : 0, basis: String(a.basis ?? "").slice(0, 80) });
  }
  return out;
}

/** Fill the database: products without an estimate yet, best-sellers first. `calls` AI calls, `parallel` at a time. */
export async function buildLifespans(calls = 10, parallel = 5) {
  const { liveProducts } = await import("@/lib/pricing");
  const list = (await liveProducts()).list
    .filter((p) => p.status !== "draft")
    .sort((a, b) => Number(b.inStock) - Number(a.inStock) || Number(b.tags.includes("favorite")) - Number(a.tags.includes("favorite")) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
  const bySlug = new Map<string, Item>();
  for (const p of list) if (!bySlug.has(p.slug)) bySlug.set(p.slug, { slug: p.slug, brand: p.brand, name: p.name, size: p.size, category: p.category });
  const have = await getLives([...bySlug.keys()]);
  const todo = [...bySlug.values()].filter((p) => !have.has(p.slug));
  const batches: Item[][] = [];
  for (let i = 0; i < todo.length && batches.length < calls; i += 40) batches.push(todo.slice(i, i + 40));
  let saved = 0;
  for (let i = 0; i < batches.length; i += parallel) {
    const res = await Promise.all(batches.slice(i, i + parallel).map(judge));
    const cmds: string[] = [];
    for (const m of res) for (const [slug, l] of m) { cmds.push(slug, JSON.stringify({ ...l, by: "ai", v: 1 } satisfies Life)); saved++; }
    if (cmds.length) await db.cmd(["HSET", H, ...cmds]);
  }
  return { saved, remaining: Math.max(0, todo.length - saved), total: bySlug.size };
}
