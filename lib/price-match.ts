import "server-only";

// Price guarantee. Every night the competitor shops listed in Admin › Pricing › SuperPrice are
// read (their public Shopify product feed), each of their products is matched to ours (barcode
// first, then brand + name + size), and the lowest competitor price is stored per product.
// The storefront then sells at that price when it is lower than ours, but never below
// cost + marginPct. Nothing in the catalogue is rewritten: when the competitor goes back up,
// our own price comes back on its own.
//
// Work is split in steps (one shop at a time, then "apply") so each call stays well inside the
// function time limit; each step starts the next one.

import { db } from "@/lib/db";
import { getIndex } from "@/lib/catalog";
import type { ProductLite } from "@/lib/data/catalog";
import { getGrowth } from "@/lib/growth-store";
import { brandKey, score, sizesOf, tokensOf } from "@/lib/import/photo-match";
import type { SourceProduct } from "@/lib/import/shopify-source";
import { landed } from "@/lib/sourcing";
import { getSourcing } from "@/lib/site-store";
import type { PriceMatch, PriceMatchSite } from "@/lib/growth";

const STATE = "pm:state";
const OFFERS = (d: string) => `pm:o:${d}`; // productId → "price|url|how"
const PRICES = "pm:prices"; // productId → JSON Match (what the shop uses)
const CMP = "pm:cmp"; // productId → JSON Cmp: a shop sells it for the same or more (we are the best price)
const VER = "pm:ver";
const REPORT = "pm:report";
const BUDGET_MS = 230_000;
// Competitor benchmark, refreshed with every price check (admin only, never shown to shoppers).
const STAT = (d: string) => `pm:stat:${d}`; // products, variants, inStock, supplements, protein, priceSum, priceN
const BRANDS = (d: string) => `pm:brands:${d}`; // set of brand names
const TYPES = (d: string) => `pm:types:${d}`; // product type → count
const BCOUNT = (d: string) => `pm:bcount:${d}`; // brand → products
// Competitor price database (kept across runs): per shop, productId → Rec (price, sale "was" price,
// link, how it was matched, confidence, first/last seen and the last price changes).
const DB = (d: string) => `pm:db:${d}`;
export type Rec = { p: number; was?: number; u: string; how: "barcode" | "name" | "confirmed"; c: number; first: string; seen: string; h: [string, number][] };
// Matches to review: name matches below AUTO_OK confidence are not used until someone confirms them.
const REVIEW = "pm:review"; // key → JSON Review
const YES = "pm:yes"; // confirmed pairs "productId|domain|variantId"
const NO = "pm:no"; // rejected pairs
const AUTO_OK = 0.9; // name matches already need the same brand, the same size and every word of our name
// Words that make it a different item from ours (a set, a refill, a travel size…) when only their side has them.
const RISK = /\b(set|kit|coffret|bundle|duo|trio|pack|pcs|refill|recharge|eco ?refill|travel|mini|sample|tester|gift|offer|x ?[2-9]|[2-9] ?x|[2-9] ?for)\b/i;
export type Review = { key: string; id: string; ours: string; oursPrice: number; theirs: string; theirsPrice: number; site: string; url: string; c: number; at: string };

export const SUPP = /\b(supplement|vitamin|multivitamin|capsule|softgel|tablet|gumm(y|ies)|collagen|omega|fish oil|probiotic|magnesium|zinc|iron|biotin|melatonin|ashwagandha|electrolyte|whey|protein powder|isolate|casein|creatine|bcaa|eaa|glutamine|pre-?workout|mass gainer|nutrition)\b/i;
export const PROTEIN = /\b(whey|protein powder|protein bar|isolate|casein|creatine|bcaa|eaa|mass gainer|pre-?workout|plant protein)\b/i;

async function statPage(domain: string, page: SourceProduct[]) {
  if (!page.length) return;
  let variants = 0, inStock = 0, supp = 0, prot = 0, sum = 0, n = 0;
  const brands = new Set<string>();
  const bcount = new Map<string, number>();
  const types = new Map<string, number>();
  for (const sp of page) {
    const tags = Array.isArray(sp.tags) ? sp.tags.join(" ") : sp.tags ?? "";
    const text = `${sp.title} ${sp.product_type ?? ""} ${tags}`;
    if (SUPP.test(text) && !/\b(hair|shampoo|conditioner|serum|cream|lotion)\b/i.test(sp.title)) supp++;
    if (PROTEIN.test(text) && !/\b(hair|shampoo|conditioner)\b/i.test(sp.title)) prot++;
    if (sp.vendor?.trim()) {
      const b = sp.vendor.trim().toUpperCase().slice(0, 40);
      brands.add(b);
      bcount.set(b, (bcount.get(b) ?? 0) + 1);
    }
    const ty = (sp.product_type || "Other").trim().slice(0, 40) || "Other";
    types.set(ty, (types.get(ty) ?? 0) + 1);
    for (const v of sp.variants ?? []) {
      variants++;
      if (v.available) inStock++;
      const pr = Number(v.price);
      if (pr > 0) (sum += pr, n++);
    }
  }
  const ops: (string | number)[][] = [
    ["HINCRBY", STAT(domain), "products", page.length], ["HINCRBY", STAT(domain), "variants", variants], ["HINCRBY", STAT(domain), "inStock", inStock],
    ["HINCRBY", STAT(domain), "supplements", supp], ["HINCRBY", STAT(domain), "protein", prot],
    ["HINCRBYFLOAT", STAT(domain), "priceSum", Math.round(sum * 100) / 100], ["HINCRBY", STAT(domain), "priceN", n],
    ["SADD", BRANDS(domain), ...brands],
  ];
  for (const [k, c] of types) ops.push(["HINCRBY", TYPES(domain), k, c]);
  for (const [k, c] of bcount) ops.push(["HINCRBY", BCOUNT(domain), k, c]);
  await db.pipeline(ops.filter((o) => o[0] !== "SADD" || o.length > 2) as string[][]);
}

/** Admin benchmark: what each shop carries (from the last price check). */
export async function competitorStats() {
  const g = (await getGrowth()).priceMatch;
  const idx = await getIndex();
  const out = [];
  for (const s of g.sites) {
    const [st, brands, types, bc] = await Promise.all([
      db.cmd<string[] | null>(["HGETALL", STAT(s.domain)]),
      db.cmd<number>(["SCARD", BRANDS(s.domain)]),
      db.cmd<string[] | null>(["HGETALL", TYPES(s.domain)]),
      db.cmd<string[] | null>(["HGETALL", BCOUNT(s.domain)]),
    ]);
    const tb: [string, number][] = [];
    for (let i = 0; bc && i < bc.length; i += 2) tb.push([bc[i], Number(bc[i + 1])]);
    tb.sort((a, b) => b[1] - a[1]);
    const o: Record<string, number> = {};
    for (let i = 0; st && i < st.length; i += 2) o[st[i]] = Number(st[i + 1]);
    const t: [string, number][] = [];
    for (let i = 0; types && i < types.length; i += 2) t.push([types[i], Number(types[i + 1])]);
    t.sort((a, b) => b[1] - a[1]);
    // Price index on the products both shops sell: their price ÷ ours (1.10 = they're 10% dearer).
    const ratios: number[] = [];
    let cursor = "0";
    do {
      const [next, flat] = (await db.cmd<[string, string[]]>(["HSCAN", OFFERS(s.domain), cursor, "COUNT", 2000])) ?? ["0", []];
      for (let i = 0; i < flat.length; i += 2) {
        const ours = idx.byId.get(flat[i]);
        const t = Number(flat[i + 1].split("|")[0]);
        if (ours && ours.status === "active" && ours.price > 0 && t > 0) ratios.push(t / ours.price);
      }
      cursor = String(next);
    } while (cursor !== "0");
    ratios.sort((a, b) => a - b);
    const med = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 0;
    const overlap = { n: ratios.length, median: Math.round(med * 1000) / 1000, cheaperThanUs: ratios.filter((r) => r < 0.995).length, sameAsUs: ratios.filter((r) => r >= 0.995 && r <= 1.005).length, dearerThanUs: ratios.filter((r) => r > 1.005).length };
    out.push({ domain: s.domain, label: s.label, enabled: s.enabled, overlap, products: o.products ?? 0, variants: o.variants ?? 0, inStock: o.inStock ?? 0, brands: brands ?? 0, supplements: o.supplements ?? 0, protein: o.protein ?? 0, avgPrice: o.priceN ? Math.round((o.priceSum / o.priceN) * 100) / 100 : 0, topTypes: t.slice(0, 8), topBrands: tb.slice(0, 10) });
  }
  return out;
}

/** We are already the best price: t = the cheapest other shop, s = that shop. */
/** Every shop that sells it: [name, price, show name]. */
export type Shop = [string, number, boolean];
/** Shops we buy from are compared against but never named to customers. */
const isSupplier = (d: string) => ["neovitale.com", "skinsociety.me", "nexuscare.me"].includes(d.toLowerCase().replace(/^www\./, ""));
export type Cmp = { t: number; s: string; show: boolean; all?: Shop[]; lose?: boolean };
/** What the storefront needs for one product: p = SuperPrice, t = competitor price, s = shop. */
export type Match = { p: number; t: number; s: string; show: boolean; u: string; est?: boolean; all?: Shop[]; beat?: "full" | "partial" };

export type SiteReport = { domain: string; label: string; products: number; matched: number; byBarcode: number; error?: string };
export type Flag = { id: string; name: string; ours: number; theirs: number; floor: number; site: string; url: string; why: "below floor" | "no cost" | "check match" };
export type Matched = { id: string; name: string; ours: number; theirs: number; superPrice: number; cost: number; margin: number; est: boolean; site: string };
export type Report = { at: string; sites: SiteReport[]; matched: number; cheaper: number; matchedNow: number; flags: Flag[]; superPrices?: Matched[]; avgMargin?: { before: number; after: number }; estimated?: number };

type State = { run: string; site: number; page: number; startedAt: string; sites: SiteReport[]; error?: string; tries?: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "").replace(/^0+/, "");

// ── Reading a competitor ────────────────────────────────────

async function fetchPage(domain: string, page: number, tries = 0): Promise<SourceProduct[]> {
  if (page > 1) await new Promise((ok) => setTimeout(ok, 400)); // be gentle: some shops limit requests
  const res = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SuperYou-PriceCheck/1.0)", Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (res.status === 429 && tries < 4) {
    await new Promise((ok) => setTimeout(ok, 4000 * (tries + 1)));
    return fetchPage(domain, page, tries + 1);
  }
  if (!res.ok) throw new Error(`answered ${res.status}`);
  const j = (await res.json()) as { products?: SourceProduct[] };
  if (!Array.isArray(j.products)) throw new Error("no public product feed");
  return j.products;
}

/** The shop's currency (prices in the feed are in it). Only US dollars are compared. */
async function currencyOf(domain: string): Promise<string> {
  try {
    const res = await fetch(`https://${domain}/cart.js`, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const j = (await res.json()) as { currency?: string };
    return (j.currency || "USD").toUpperCase();
  } catch {
    return "USD";
  }
}

// ── Matching ────────────────────────────────────────────────

type Ours = { p: ProductLite; tokens: Set<string>; sizes: Set<string> };
type Book = { byBarcode: Map<string, ProductLite[]>; byBrand: Map<string, Ours[]>; byVariant: Map<string, ProductLite[]> };

export function bookOf(all: ProductLite[], domain: string, excludeSource?: string): Book {
  const byBarcode = new Map<string, ProductLite[]>();
  // Items we imported from this very shop carry its variant id in their SKU ("NEO-4567…").
  const byVariant = new Map<string, ProductLite[]>();
  const byBrand = new Map<string, Ours[]>();
  for (const p of all) {
    if (p.status !== "active" || p.brand === "SuperYou Clinic") continue;
    if (excludeSource && (p.source ?? "").toLowerCase() === excludeSource) continue;
    const b = digits(p.barcode);
    if (b.length >= 8) (byBarcode.get(b) ?? byBarcode.set(b, []).get(b)!).push(p);
    const vid = (p.source ?? "").toLowerCase() === domain ? p.sku.match(/-(\d{6,})$/)?.[1] : undefined;
    if (vid) (byVariant.get(vid) ?? byVariant.set(vid, []).get(vid)!).push(p);
    const sizes = sizesOf([p.name, p.variant ?? "", p.size ?? ""].join(" "));
    if (!sizes.size) continue; // shades and sets without a size: barcode only
    const k = brandKey(p.brand);
    (byBrand.get(k) ?? byBrand.set(k, []).get(k)!).push({ p, tokens: tokensOf(p.name, p.brand), sizes });
  }
  return { byBarcode, byBrand, byVariant };
}

/** Our products that are the same item as this competitor variant. */
export function matchVariant(book: Book, sp: SourceProduct, v: SourceProduct["variants"][number]): { ids: string[]; how: "barcode" | "name"; score: number } | null {
  const same = book.byVariant.get(String(v.id));
  if (same?.length) return { ids: same.map((p) => p.id), how: "barcode", score: 1 };
  // Public feeds hide the barcode field; many shops put the barcode in the SKU instead.
  const b = digits(v.barcode || (v.sku && /^\d{8,14}$/.test(v.sku.trim()) ? v.sku : ""));
  if (b.length >= 8) {
    const hit = book.byBarcode.get(b);
    if (hit?.length) return { ids: hit.map((p) => p.id), how: "barcode", score: 1 };
  }
  const k = brandKey(sp.vendor || "");
  let cands = book.byBrand.get(k);
  if (!cands && k.length >= 4) for (const [kk, list] of book.byBrand) if (kk.includes(k) || k.includes(kk)) cands = [...(cands ?? []), ...list];
  if (!cands) return null;
  const vt = v.title && v.title !== "Default Title" ? v.title : "";
  const sizes = sizesOf(sp.variants.length > 1 ? vt || sp.title : `${sp.title} ${vt}`);
  if (!sizes.size) return null;
  const theirs = { tokens: tokensOf(sp.title, sp.vendor), sizes };
  let best: Ours[] = [];
  let bestScore = 0.9; // strict: a wrong match would sell at the wrong price
  for (const o of cands) {
    if (![...o.sizes].some((x) => sizes.has(x))) continue;
    const s = score(o, theirs);
    if (s > bestScore + 1e-9) (best = [o]), (bestScore = s);
    else if (Math.abs(s - bestScore) < 1e-9 && best.length) best.push(o);
  }
  // Two of ours tie for the same competitor item: ambiguous, so it can only go to review.
  return best.length ? { ids: best.map((o) => o.p.id), how: "name", score: Math.min(1, best.length > 1 ? Math.min(bestScore, AUTO_OK - 0.01) : bestScore) } : null;
}

// ── Competitor price database ───────────────────────────────

/** Merges this run's offers into the long-lived database: keeps first seen, updates last seen,
 *  and records a price change (last 12 changes) whenever their price moves. */
async function saveRecs(domain: string, flat: string[]) {
  const ids = flat.filter((_, i) => i % 2 === 0);
  const old = (await db.cmd<(string | null)[]>(["HMGET", DB(domain), ...ids])) ?? [];
  const now = new Date().toISOString();
  const out: string[] = [];
  ids.forEach((id, i) => {
    const [p, u, how, c, was] = flat[i * 2 + 1].split("|");
    const price = Number(p);
    let r: Rec | null = null;
    try { r = old[i] ? (JSON.parse(old[i]!) as Rec) : null; } catch { r = null; }
    const h = r?.h ?? [];
    if (!h.length || Math.abs(h[h.length - 1][1] - price) > 0.004) h.push([now.slice(0, 10), price]);
    out.push(id, JSON.stringify({ p: price, ...(Number(was) > price ? { was: Number(was) } : {}), u, how: how as Rec["how"], c: Number(c) || 1, first: r?.first ?? now, seen: now, h: h.slice(-12) } satisfies Rec));
  });
  if (out.length) await db.cmd(["HSET", DB(domain), ...out]);
}

/** Everything we know about one product at every competitor (admin). */
export async function productRecs(id: string) {
  const sites = (await getGrowth()).priceMatch.sites;
  const raws = await Promise.all(sites.map((s) => db.cmd<string | null>(["HGET", DB(s.domain), id])));
  return sites.map((s, i) => ({ site: s.label, domain: s.domain, rec: raws[i] ? (JSON.parse(raws[i]!) as Rec) : null })).filter((x) => x.rec);
}

/** Matches waiting for a person (admin), most likely first. */
export async function reviewList(): Promise<Review[]> {
  const flat = (await db.cmd<string[] | null>(["HGETALL", REVIEW])) ?? [];
  const out: Review[] = [];
  for (let i = 1; i < flat.length; i += 2) try { out.push(JSON.parse(flat[i]) as Review); } catch { /* skip */ }
  return out.sort((a, b) => b.c - a.c).slice(0, 300);
}

/** A person confirms or rejects a suggested match; used from the next price check. */
export async function decide(key: string, ok: boolean) {
  await db.pipeline([["SADD", ok ? YES : NO, key], ["SREM", ok ? NO : YES, key], ["HDEL", REVIEW, key]]);
}

/** How much of our catalogue we can compare, and how sure we are. */
export async function coverage() {
  const idx = await getIndex();
  const sites = (await getGrowth()).priceMatch.sites.filter((s) => s.enabled);
  const active = idx.all.filter((p) => p.status === "active");
  const seen = new Map<string, { how: string; fresh: boolean }>();
  const weekAgo = Date.now() - 7 * 86400_000;
  for (const s of sites) {
    let cursor = "0";
    do {
      const [next, flat] = (await db.cmd<[string, string[]]>(["HSCAN", DB(s.domain), cursor, "COUNT", 2000])) ?? ["0", []];
      for (let i = 0; i < flat.length; i += 2) {
        try {
          const r = JSON.parse(flat[i + 1]) as Rec;
          const fresh = Date.parse(r.seen) > weekAgo;
          const prev = seen.get(flat[i]);
          const rank = (h: string) => (h === "barcode" ? 3 : h === "confirmed" ? 2 : 1);
          if (!prev || (fresh && !prev.fresh) || rank(r.how) > rank(prev.how)) seen.set(flat[i], { how: r.how, fresh: fresh || !!prev?.fresh });
        } catch { /* skip */ }
      }
      cursor = String(next);
    } while (cursor !== "0");
  }
  let exact = 0, confirmed = 0, name = 0, stale = 0;
  for (const p of active) {
    const s = seen.get(p.id);
    if (!s) continue;
    if (!s.fresh) { stale++; continue; }
    if (s.how === "barcode") exact++; else if (s.how === "confirmed") confirmed++; else name++;
  }
  const review = (await db.cmd<number>(["HLEN", REVIEW])) ?? 0;
  return { products: active.length, compared: exact + confirmed + name, exact, confirmed, name, stale, review };
}

// ── Steps ───────────────────────────────────────────────────

async function readState(): Promise<State | null> {
  const raw = await db.cmd<string | null>(["GET", STATE]);
  return raw ? (JSON.parse(raw) as State) : null;
}
const writeState = (s: State | null) => (s ? db.cmd(["SET", STATE, JSON.stringify(s), "EX", 6 * 3600]) : db.cmd(["DEL", STATE]));

/** Start a new run (nightly, or "Check now" in the admin). */
export async function startRun(): Promise<State> {
  const s: State = { run: new Date().toISOString(), site: 0, page: 1, startedAt: new Date().toISOString(), sites: [] };
  await writeState(s);
  await db.cmd(["DEL", REVIEW]); // rebuilt by this run
  return s;
}

/** Does as much of the current run as fits in one call. Returns true when there is more to do. */
export async function step(t0 = Date.now()): Promise<{ more: boolean; state: State | null }> {
  const g = (await getGrowth()).priceMatch;
  const sites = g.sites.filter((x) => x.enabled);
  let st = await readState();
  if (!st) return { more: false, state: null };
  if (!g.enabled) return (await writeState(null), { more: false, state: null });

  if (st.site < sites.length) {
    const site = sites[st.site];
    const rep: SiteReport = st.sites.find((x) => x.domain === site.domain) ?? { domain: site.domain, label: site.label, products: 0, matched: 0, byBarcode: 0 };
    if (!st.sites.includes(rep)) st.sites.push(rep);
    try {
      if (st.page === 1) {
        await db.cmd(["DEL", OFFERS(site.domain)]);
        await db.cmd(["DEL", STAT(site.domain), BRANDS(site.domain), TYPES(site.domain), BCOUNT(site.domain)]);
        const cur = await currencyOf(site.domain);
        if (cur !== "USD") throw new Error(`prices are in ${cur}, not US dollars`);
      }
      const idx = await getIndex();
      const book = bookOf(idx.all, site.domain);
      const [yes, no] = await Promise.all([db.cmd<string[]>(["SMEMBERS", YES]), db.cmd<string[]>(["SMEMBERS", NO])]).then(([a, b]) => [new Set(a ?? []), new Set(b ?? [])]);
      while (Date.now() - t0 < BUDGET_MS) {
        const page = await fetchPage(site.domain, st.page);
        await statPage(site.domain, page).catch(() => {});
        // productId → [price, url, how, confidence, their "was" price]
        const best = new Map<string, [number, string, string, number, number]>();
        const review: string[] = [];
        for (const sp of page) {
          for (const v of sp.variants ?? []) {
            const price = Number(v.price);
            if (!v.available || !(price > 0)) continue;
            const m = matchVariant(book, sp, v);
            if (!m) continue;
            const url = `https://${site.domain}/products/${sp.handle}${sp.variants.length > 1 ? `?variant=${v.id}` : ""}`;
            const was = Number((v as { compare_at_price?: string | null }).compare_at_price ?? 0);
            for (const id of m.ids) {
              const pair = `${id}|${site.domain}|${v.id}`;
              if (no.has(pair)) continue; // someone said it is not the same item
              let how: string = m.how, c = m.score;
              if (m.how === "name") {
                const ours0 = idx.byId.get(id);
                const theirText = `${sp.title} ${v.title ?? ""}`;
                const oursText = ours0 ? `${ours0.name} ${ours0.variant ?? ""} ${ours0.size ?? ""}` : "";
                // Different format (set, refill, travel size…) or a very different price: a person decides.
                const risky = (RISK.test(theirText) && !RISK.test(oursText)) || (!!ours0 && (price < ours0.price * 0.6 || price > ours0.price * 1.8));
                if (yes.has(pair)) (how = "confirmed"), (c = 1);
                else if (c < AUTO_OK || risky) {
                  // Not sure enough to sell at their price: ask a person first.
                  const ours = idx.byId.get(id);
                  if (ours) review.push(pair, JSON.stringify({ key: pair, id, ours: `${ours.brand} ${ours.name}${ours.variant ? ` · ${ours.variant}` : ""}${ours.size && ours.size !== ours.variant ? ` · ${ours.size}` : ""}`, oursPrice: ours.price, theirs: `${sp.vendor ?? ""} ${sp.title}${v.title && v.title !== "Default Title" ? ` · ${v.title}` : ""}`.trim(), theirsPrice: price, site: site.label, url, c: Math.round(Math.min(c, risky ? 0.89 : c) * 1000) / 1000, at: new Date().toISOString() } satisfies Review));
                  continue;
                }
              }
              const prev = best.get(id);
              if (!prev || price < prev[0]) best.set(id, [price, url, how, c, was > price ? was : 0]);
            }
          }
        }
        if (review.length) await db.cmd(["HSET", REVIEW, ...review]);
        rep.products += page.length;
        if (best.size) {
          // Keep the cheaper offer when a product already matched on an earlier page.
          const ids = [...best.keys()];
          const old = (await db.cmd<(string | null)[]>(["HMGET", OFFERS(site.domain), ...ids])) ?? [];
          const flat: string[] = [];
          ids.forEach((id, i) => {
            const [p, u, how, c, was] = best.get(id)!;
            const o = old[i] ? Number(old[i]!.split("|")[0]) : Infinity;
            if (p < o) flat.push(id, `${p}|${u}|${how}|${c}|${was}`);
            if (!old[i]) (rep.matched++, how !== "name" && rep.byBarcode++);
          });
          if (flat.length) {
            await db.cmd(["HSET", OFFERS(site.domain), ...flat]);
            await saveRecs(site.domain, flat);
          }
        }
        if (page.length < 250 || st.page >= 400) {
          st = { ...st, site: st.site + 1, page: 1 };
          break;
        }
        st.page++;
      }
    } catch (e) {
      rep.error = (e as Error).message.slice(0, 120);
      st = { ...st, site: st.site + 1, page: 1 };
    }
    await writeState(st);
    // Time left in this call: go on with the next shop (or the final step) right here.
    // The final step only takes seconds, so it nearly always fits.
    if (st.page === 1 && Date.now() - t0 < (st.site >= sites.length ? 270_000 : BUDGET_MS - 90_000)) return step(t0);
    return { more: true, state: st };
  }

  try {
    await apply(sites, g, st.sites);
    await (await import("@/lib/stock-alerts")).sendStockAlerts().catch(() => 0); // nightly, besides the daily run
  } catch (e) {
    // Keep the state so the next call retries the final step (at most 3 times).
    const tries = (st.tries ?? 0) + 1;
    console.error("[price-match apply]", e);
    if (tries < 3) return (await writeState({ ...st, tries, error: (e as Error).message.slice(0, 200) }), { more: true, state: st });
    await writeState(null);
    throw e;
  }
  await writeState(null);
  return { more: false, state: null };
}

/** Lowest competitor price per product → what the shop sells at. */
async function apply(sites: PriceMatchSite[], cfg: PriceMatch, siteReports: SiteReport[]) {
  const idx = await getIndex();
  const sourcing = await getSourcing();
  const best = new Map<string, { t: number; site: PriceMatchSite; u: string; how: string }>();
  const shops = new Map<string, Shop[]>();
  for (const site of sites) {
    // A shop that stopped part-way (e.g. too many requests) still counts for what was read.
    const rep = siteReports.find((r) => r.domain === site.domain);
    if (rep?.error && !rep.products) continue;
    let cursor = "0";
    do {
      const [next, flat] = (await db.cmd<[string, string[]]>(["HSCAN", OFFERS(site.domain), cursor, "COUNT", 2000])) ?? ["0", []];
      for (let i = 0; i < flat.length; i += 2) {
        const [p, u, how] = flat[i + 1].split("|");
        const t = Number(p);
        // The shop a product is bought from is not a competitor for it (we'd be undercutting our own supplier).
        const own = cfg.skipOwnSource && (idx.byId.get(flat[i])?.source ?? "").toLowerCase() === site.domain;
        if (own) continue;
        const prev = best.get(flat[i]);
        if (!prev || t < prev.t) best.set(flat[i], { t, site, u, how });
        (shops.get(flat[i]) ?? shops.set(flat[i], []).get(flat[i])!).push([site.label, r2(t), site.showName && !isSupplier(site.domain)]);
      }
      cursor = String(next);
    } while (cursor !== "0");
  }

  const prices: string[] = [];
  const flags: Flag[] = [];
  const supers: Matched[] = [];
  let cheaper = 0, matchedNow = 0, estimated = 0, mBefore = 0, mAfter = 0;
  const cmp: string[] = [];
  for (const [id, b] of best) {
    const p = idx.byId.get(id);
    if (!p || p.status !== "active") continue;
    // Same price as a shop (within 0.5%): go tieBeatPct below them. Cheaper there: beatPct below.
    const tie = b.t >= p.price - 0.005 && b.t <= p.price * 1.005;
    if (b.t > p.price * 1.005 || (tie && !cfg.tieBeatPct)) {
      cmp.push(id, JSON.stringify({ t: r2(b.t), s: b.site.label, show: b.site.showName && !isSupplier(b.site.domain), all: (shops.get(id) ?? []).sort((x, y) => x[1] - y[1]) } satisfies Cmp));
      continue;
    }
    cheaper++;
    const name = `${p.brand} ${p.name}${p.variant ? ` · ${p.variant}` : ""}`;
    // A shop is cheaper and we can't (or shouldn't) go below it: the storefront must not claim the best price.
    const lose = () => cmp.push(id, JSON.stringify({ t: r2(b.t), s: b.site.label, show: b.site.showName && !isSupplier(b.site.domain), all: (shops.get(id) ?? []).sort((x, y) => x[1] - y[1]), lose: true } satisfies Cmp));
    const flag = (why: Flag["why"], floor = 0) => (lose(), flags.push({ id, name, ours: p.price, theirs: b.t, floor: r2(floor), site: b.site.label, url: b.u, why }));
    // A name match far below our price is more likely a different size or a mistake.
    if (b.how === "name" && b.t < p.price * 0.5) { flag("check match"); continue; }
    const known = !!p.cost && p.cost > 0;
    if (!known && !cfg.assumeMarginPct) { flag("no cost"); continue; }
    const rule = sourcing.sources.find((x) => x.source.toLowerCase() === (p.source ?? "").toLowerCase());
    // No cost on file: estimated from our price and the assumed margin (a trial setting).
    const cost = !known ? p.price * (1 - cfg.assumeMarginPct / 100) : rule?.origin === "international" && rule.pricing ? landed(p.cost!, rule.pricing).landed : p.cost!;
    const floor = r2(cost * (1 + cfg.marginPct / 100));
    const target = r2(b.t * (1 - (tie ? cfg.tieBeatPct : cfg.beatPct) / 100));
    const cap = r2(p.price * (1 - cfg.maxOffPct / 100));
    const sp = Math.max(target, floor, cap);
    // Only when we end up truly cheaper than the competitor (and cheaper than today).
    if (sp >= b.t - 0.005 || sp >= p.price - 0.005) {
      if (tie) cmp.push(id, JSON.stringify({ t: r2(b.t), s: b.site.label, show: b.site.showName && !isSupplier(b.site.domain), all: (shops.get(id) ?? []).sort((x, y) => x[1] - y[1]) } satisfies Cmp));
      else flag("below floor", Math.max(floor, cap));
      continue;
    }
    matchedNow++;
    if (!known) estimated++;
    mBefore += (p.price - cost) / p.price;
    mAfter += (sp - cost) / sp;
    supers.push({ id, name, ours: p.price, theirs: b.t, superPrice: sp, cost: r2(cost), margin: Math.round(((sp - cost) / sp) * 1000) / 10, est: !known, site: b.site.label });
    const m: Match = { p: sp, t: r2(b.t), s: b.site.label, show: b.site.showName && !isSupplier(b.site.domain), u: b.u, ...(known ? {} : { est: true }), all: (shops.get(id) ?? []).sort((x, y) => x[1] - y[1]), beat: sp <= target + 0.005 ? "full" : "partial" };
    prices.push(id, JSON.stringify(m));
  }
  await db.cmd(["DEL", PRICES]);
  for (let i = 0; i < prices.length; i += 1000) await db.cmd(["HSET", PRICES, ...prices.slice(i, i + 1000)]);
  await db.cmd(["DEL", CMP]);
  for (let i = 0; i < cmp.length; i += 2000) await db.cmd(["HSET", CMP, ...cmp.slice(i, i + 2000)]);
  await db.cmd(["INCR", VER]);
  flags.sort((a, b) => b.ours - b.theirs - (a.ours - a.theirs));
  supers.sort((a, b) => b.ours - b.superPrice - (a.ours - a.superPrice));
  const n = matchedNow || 1;
  const report: Report = {
    at: new Date().toISOString(), sites: siteReports, matched: best.size, cheaper, matchedNow, flags: flags.slice(0, 300),
    superPrices: supers.slice(0, 500), avgMargin: { before: Math.round((mBefore / n) * 1000) / 10, after: Math.round((mAfter / n) * 1000) / 10 }, estimated,
  };
  await db.cmd(["SET", REPORT, JSON.stringify(report)]);
  g.__pm = undefined;
}

export async function getReport(): Promise<{ report: Report | null; running: State | null }> {
  const [raw, running] = await Promise.all([db.cmd<string | null>(["GET", REPORT]), readState()]);
  return { report: raw ? (JSON.parse(raw) as Report) : null, running };
}

// ── What the storefront reads ───────────────────────────────

const g = globalThis as unknown as { __pm?: { ver: string; at: number; map: Map<string, Match>; cmp: Map<string, Cmp> } };

/** Matched prices, cached per server instance and re-checked every minute. */
export async function priceMatches(): Promise<{ ver: string; map: Map<string, Match>; cmp: Map<string, Cmp> }> {
  const now = Date.now();
  if (g.__pm && now - g.__pm.at < 60_000) return g.__pm;
  try {
    const ver = String((await db.cmd<string | number | null>(["GET", VER])) ?? "0");
    if (g.__pm && g.__pm.ver === ver) return (g.__pm.at = now), g.__pm;
    const map = new Map<string, Match>();
    let cursor = "0";
    do {
      const [next, flat] = (await db.cmd<[string, string[]]>(["HSCAN", PRICES, cursor, "COUNT", 3000])) ?? ["0", []];
      for (let i = 0; i < flat.length; i += 2) map.set(flat[i], JSON.parse(flat[i + 1]) as Match);
      cursor = String(next);
    } while (cursor !== "0");
    const cmp = new Map<string, Cmp>();
    cursor = "0";
    do {
      const [next, flat] = (await db.cmd<[string, string[]]>(["HSCAN", CMP, cursor, "COUNT", 5000])) ?? ["0", []];
      for (let i = 0; i < flat.length; i += 2) cmp.set(flat[i], JSON.parse(flat[i + 1]) as Cmp);
      cursor = String(next);
    } while (cursor !== "0");
    g.__pm = { ver, at: now, map, cmp };
  } catch {
    g.__pm = { ver: "0", at: now, map: new Map(), cmp: new Map() };
  }
  return g.__pm;
}

// ── Margin analysis (admin) ─────────────────────────────────

type Bucket = { n: number; marginNow: number; marginAtMatch: number; marginAtBeat: number; marginFinal: number };
/** What matching (or beating by beatPct) would do to our margins, from the last check's offers. */
export async function analyse(beatPct = 5, marginPct = 10, assumeMarginPct = 0) {
  const idx = await getIndex();
  const sourcing = await getSourcing();
  const sites = (await getGrowth()).priceMatch.sites.filter((x) => x.enabled);
  const best = new Map<string, { t: number; site: string; how: string }>();
  for (const site of sites) {
    let cursor = "0";
    do {
      const [next, flat] = (await db.cmd<[string, string[]]>(["HSCAN", OFFERS(site.domain), cursor, "COUNT", 2000])) ?? ["0", []];
      for (let i = 0; i < flat.length; i += 2) {
        const [p, , how] = flat[i + 1].split("|");
        const t = Number(p);
        const prev = best.get(flat[i]);
        if (!prev || t < prev.t) best.set(flat[i], { t, site: site.label, how });
      }
      cursor = String(next);
    } while (cursor !== "0");
  }
  const out = {
    found: best.size, cheaperThere: 0, noCost: 0, suspicious: 0,
    full: { n: 0 } as Record<string, number>, floorOnly: 0, stillDearer: 0,
    bySite: {} as Record<string, number>, bySource: {} as Record<string, { cheaper: number; withCost: number }>,
    gapPct: [] as number[], dropPct: [] as number[], revenueNow: 0, revenueFinal: 0, profitNow: 0, profitFinal: 0, all: { n: 0, marginNow: 0, marginAtMatch: 0, marginAtBeat: 0, marginFinal: 0 } as Bucket,
    priceDrop: 0, examples: [] as { name: string; ours: number; theirs: number; cost: number; final: number; marginFinal: number; site: string }[],
  };
  for (const [id, b] of best) {
    const p = idx.byId.get(id);
    if (!p || p.status !== "active" || b.t >= p.price - 0.005) continue;
    out.cheaperThere++;
    out.bySite[b.site] = (out.bySite[b.site] ?? 0) + 1;
    const src = (p.source || "manual").toLowerCase();
    const bs = (out.bySource[src] ??= { cheaper: 0, withCost: 0 });
    bs.cheaper++;
    if (b.how === "name" && b.t < p.price * 0.5) { out.suspicious++; continue; }
    const known = !!p.cost && p.cost > 0;
    if (!known) out.noCost++;
    if (!known && !assumeMarginPct) continue;
    if (known) bs.withCost++;
    const rule = sourcing.sources.find((x) => x.source.toLowerCase() === src);
    // No cost on file: estimate it from our price and an assumed margin (planning only).
    const c = !known ? p.price * (1 - assumeMarginPct / 100) : rule?.origin === "international" && rule.pricing ? landed(p.cost!, rule.pricing).landed : p.cost!;
    const floor = c * (1 + marginPct / 100);
    const beat = b.t * (1 - beatPct / 100);
    const final = Math.min(p.price, Math.max(beat, floor));
    if (final >= b.t - 0.005) out.stillDearer++;
    else if (final > beat + 0.005) out.floorOnly++;
    else out.full.n++;
    out.gapPct.push(((p.price - b.t) / p.price) * 100);
    out.dropPct.push(((p.price - final) / p.price) * 100);
    const m = (x: number) => (x - c) / x;
    out.all.n++;
    out.all.marginNow += m(p.price); out.all.marginAtMatch += m(b.t); out.all.marginAtBeat += m(beat); out.all.marginFinal += m(final);
    out.priceDrop += p.price - final;
    out.revenueNow += p.price; out.revenueFinal += final; out.profitNow += p.price - c; out.profitFinal += final - c;
    if (out.examples.length < 15) out.examples.push({ name: `${p.brand} ${p.name}${p.variant ? ` · ${p.variant}` : ""}`, ours: p.price, theirs: b.t, cost: r2(c), final: r2(final), marginFinal: Math.round(m(final) * 1000) / 10, site: b.site });
  }
  const n = out.all.n || 1;
  const pct = (x: number) => Math.round((x / n) * 1000) / 10;
  const gaps = out.gapPct.sort((a, b) => a - b);
  return {
    found: out.found, cheaperThere: out.cheaperThere, noCost: out.noCost, suspicious: out.suspicious, withCost: out.all.n,
    beatFully: out.full.n, onlyToFloor: out.floorOnly, stillDearer: out.stillDearer,
    avgMargin: { now: pct(out.all.marginNow), atMatch: pct(out.all.marginAtMatch), atBeat: pct(out.all.marginAtBeat), final: pct(out.all.marginFinal) },
    gapBands: [5, 10, 20, 30, 100].map((hi, i, a) => ({ upTo: hi, n: gaps.filter((x) => x > (i ? a[i - 1] : 0) && x <= hi).length })),
    profitPerUnitSoldNow: r2(out.profitNow / n), profitPerUnitSoldFinal: r2(out.profitFinal / n),
    medianGapPct: gaps.length ? Math.round(gaps[Math.floor(gaps.length / 2)] * 10) / 10 : 0,
    avgPriceDrop: r2(out.priceDrop / n), bySite: out.bySite, bySource: out.bySource, examples: out.examples,
  };
}

/** Names of the shops actually read in the last price check (for the storefront's "checked against" list). */
const gs = globalThis as unknown as { __pmOk?: { at: number; list: string[] } };
export async function shopsRead(): Promise<string[] | null> {
  if (gs.__pmOk && Date.now() - gs.__pmOk.at < 600_000) return gs.__pmOk.list;
  const raw = await db.cmd<string | null>(["GET", REPORT]).catch(() => null);
  if (!raw) return null;
  const r = JSON.parse(raw) as Report;
  const list = r.sites.filter((x) => x.products > 0 && !x.error).map((x) => x.label);
  gs.__pmOk = { at: Date.now(), list };
  return list;
}
