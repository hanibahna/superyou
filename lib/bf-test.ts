import "server-only";
import { db } from "@/lib/db-core";
import { BF, bfLines, bfState, getBanner, saveBanner, saveBf, type Banner } from "@/lib/black-friday";
import { getPromotions, savePromotions } from "@/lib/site-store";
import { getIndex } from "@/lib/catalog";
import { liveProducts } from "@/lib/pricing";
import { floorPrice, getMargins } from "@/lib/margins";

// Test mode: one switch turns Black Friday on with random picks and discounts (always above the
// minimum margin) until 30 November 23:59 Beirut. Switching it off puts the manual setup back exactly.
const SNAP = "bf:test:snapshot";
const FLAG = "bf:test";
export const TEST_END = "2026-11-30T21:59:00.000Z"; // 30 Nov 23:59 in Beirut

export async function testStatus() {
  const raw = await db.cmd<string | null>(["GET", FLAG]).catch(() => null);
  return raw ? (JSON.parse(raw) as { on: true; at: string; items: number }) : { on: false as const };
}

export async function testOn() {
  if ((await testStatus()).on) return testStatus();
  const [banner, promos, idx, live, m] = await Promise.all([getBanner(), getPromotions(), getIndex(), liveProducts(), getMargins()]);
  await db.cmd(["SET", SNAP, JSON.stringify({ banner, lines: promos.discounts.filter((d) => d.id.startsWith(BF)) })]);
  // Random in-stock products with a known cost and room for a discount above the floor.
  const seen = new Set<string>();
  const pool = live.list.filter((p) => {
    const raw = idx.byId.get(p.id);
    if (!raw || !p.inStock || !p.image || seen.has(p.slug)) return false;
    const fl = floorPrice(raw, m);
    if (fl === undefined || (raw.price - fl) / raw.price < 0.08) return false;
    seen.add(p.slug);
    return true;
  });
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const items = pool.slice(0, 8).map((p) => {
    const raw = idx.byId.get(p.id)!;
    const room = Math.floor(((raw.price - floorPrice(raw, m)!) / raw.price) * 100);
    return { slug: p.slug, pct: Math.max(5, Math.min(30, 5 + Math.floor(Math.random() * Math.max(1, room - 4)))) };
  });
  const b: Banner = { items, startsAt: new Date().toISOString(), endsAt: TEST_END, enabled: true, headline: true, fx: { strip: true, daily: true, confetti: true, stamps: false, stampPoints: 20, stampBonus: 100 } };
  await saveBanner(b);
  await db.cmd(["SET", FLAG, JSON.stringify({ on: true, at: new Date().toISOString(), items: items.length })]);
  return testStatus();
}

export async function testOff() {
  const raw = await db.cmd<string | null>(["GET", SNAP]).catch(() => null);
  if (raw) {
    const snap = JSON.parse(raw) as { banner: Banner; lines: { id: string }[] };
    await saveBanner(snap.banner);
    const promos = await getPromotions();
    await savePromotions({ ...promos, discounts: [...promos.discounts.filter((d) => !d.id.startsWith(BF)), ...(snap.lines as typeof promos.discounts)] });
  }
  await db.cmd(["DEL", FLAG, SNAP]);
  return { on: false as const };
}

// ── AI: "20% off La Roche-Posay sunscreens and 15% on Vichy until Monday" → a draft to review ──
export type AiPlan = { note: string; startsAt?: string; endsAt?: string; brands: { brand: string; pct: number; marginPct: number | null }[]; products: { query: string; pct: number; matches: { slug: string; brand: string; name: string; price: number; maxMarginPct: number | null }[] }[] };

export async function aiPlan(request: string): Promise<AiPlan | { error: string }> {
  const { anthropicKey } = await import("@/lib/extras");
  const key = await anthropicKey();
  if (!key) return { error: "No AI key is set (Admin → Sections & AI)." };
  const [lines, m] = await Promise.all([bfLines(), getMargins()]);
  const brands = lines.filter((l) => l.inStock > 0).map((l) => `${l.brand} (margin ${l.marginPct ?? "unknown"}%)`).slice(0, 400).join("; ");
  const today = new Date().toLocaleString("en-GB", { timeZone: "Asia/Beirut", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const prompt = `You set up Black Friday discounts for SuperYou, a Lebanese beauty and pharmacy shop. Now in Beirut: ${today}. Minimum margin rule: no discount may take a product below ${m.floorPct}% margin, so a brand's discount must be lower than (its margin − ${m.floorPct}). Brands on sale in the shop with their margin: ${brands}.

The owner asks: """${request.slice(0, 2000)}"""

Reply with JSON only, no prose: {"note": "one short sentence on what you set and anything you capped or could not do", "startsAt": "ISO date-time with +02:00 or empty", "endsAt": "ISO date-time with +02:00 or empty", "brands": [{"brand": "exact brand name from the list", "pct": number}], "products": [{"query": "search words for specific products", "pct": number}]}. Use brands for whole-brand discounts and products for specific items or product types. Cap each discount below the margin limit and say so in note.`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_TIPS_MODEL || "claude-sonnet-5-5", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) return { error: `AI request failed (${r.status})` };
  const text = ((await r.json()) as { content?: { text?: string }[] }).content?.map((c) => c.text ?? "").join("") ?? "";
  let j: { note?: string; startsAt?: string; endsAt?: string; brands?: { brand: string; pct: number }[]; products?: { query: string; pct: number }[] };
  try { j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { return { error: "The AI reply could not be read. Try rewording." }; }
  const { searchCandidates } = await import("@/lib/black-friday");
  const byBrand = new Map(lines.map((l) => [l.brand.toLowerCase(), l]));
  const clamp = (n: number) => Math.max(0, Math.min(90, Math.round(Number(n) || 0)));
  return {
    note: j.note ?? "",
    startsAt: j.startsAt || undefined, endsAt: j.endsAt || undefined,
    brands: (j.brands ?? []).filter((b) => byBrand.has(String(b.brand).toLowerCase())).map((b) => { const l = byBrand.get(String(b.brand).toLowerCase())!; return { brand: l.brand, pct: clamp(b.pct), marginPct: l.marginPct }; }),
    products: await Promise.all((j.products ?? []).slice(0, 10).map(async (p) => ({ query: String(p.query), pct: clamp(p.pct), matches: (await searchCandidates(String(p.query))).filter((c) => c.inStock).slice(0, 20).map((c) => ({ slug: c.slug, brand: c.brand, name: c.name, price: c.price, maxMarginPct: c.maxMarginPct })) }))),
  };
}
export { bfState, saveBf };
