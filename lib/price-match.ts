import "server-only";

// Price guarantee. Every night the competitor shops listed in Admin › Growth › Price match are
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
import type { PriceMatchSite } from "@/lib/growth";

const STATE = "pm:state";
const OFFERS = (d: string) => `pm:o:${d}`; // productId → "price|url|how"
const PRICES = "pm:prices"; // productId → JSON Match (what the shop uses)
const VER = "pm:ver";
const REPORT = "pm:report";
const BUDGET_MS = 230_000;

/** What the storefront needs for one product. t = competitor price, f = our floor. */
export type Match = { t: number; f: number; s: string; show: boolean; u: string };

export type SiteReport = { domain: string; label: string; products: number; matched: number; byBarcode: number; error?: string };
export type Flag = { id: string; name: string; ours: number; theirs: number; floor: number; site: string; url: string; why: "below floor" | "no cost" | "check match" };
export type Report = { at: string; sites: SiteReport[]; matched: number; cheaper: number; matchedNow: number; flags: Flag[] };

type State = { run: string; site: number; page: number; startedAt: string; sites: SiteReport[] };

const r2 = (n: number) => Math.round(n * 100) / 100;
const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "").replace(/^0+/, "");

// ── Reading a competitor ────────────────────────────────────

async function fetchPage(domain: string, page: number): Promise<SourceProduct[]> {
  const res = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SuperYou-PriceCheck/1.0)", Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
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
type Book = { byBarcode: Map<string, ProductLite[]>; byBrand: Map<string, Ours[]> };

function bookOf(all: ProductLite[]): Book {
  const byBarcode = new Map<string, ProductLite[]>();
  const byBrand = new Map<string, Ours[]>();
  for (const p of all) {
    if (p.status !== "active" || p.brand === "SuperYou Clinic") continue;
    const b = digits(p.barcode);
    if (b.length >= 8) (byBarcode.get(b) ?? byBarcode.set(b, []).get(b)!).push(p);
    const sizes = sizesOf([p.name, p.variant ?? "", p.size ?? ""].join(" "));
    if (!sizes.size) continue; // shades and sets without a size: barcode only
    const k = brandKey(p.brand);
    (byBrand.get(k) ?? byBrand.set(k, []).get(k)!).push({ p, tokens: tokensOf(p.name, p.brand), sizes });
  }
  return { byBarcode, byBrand };
}

/** Our products that are the same item as this competitor variant. */
function matchVariant(book: Book, sp: SourceProduct, v: SourceProduct["variants"][number]): { ids: string[]; how: "barcode" | "name" } | null {
  const b = digits(v.barcode);
  if (b.length >= 8) {
    const hit = book.byBarcode.get(b);
    if (hit?.length) return { ids: hit.map((p) => p.id), how: "barcode" };
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
  return best.length ? { ids: best.map((o) => o.p.id), how: "name" } : null;
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
  return s;
}

/** Does as much of the current run as fits in one call. Returns true when there is more to do. */
export async function step(): Promise<{ more: boolean; state: State | null }> {
  const t0 = Date.now();
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
        const cur = await currencyOf(site.domain);
        if (cur !== "USD") throw new Error(`prices are in ${cur}, not US dollars`);
      }
      const book = bookOf((await getIndex()).all);
      while (Date.now() - t0 < BUDGET_MS) {
        const page = await fetchPage(site.domain, st.page);
        const best = new Map<string, [number, string, string]>();
        for (const sp of page) {
          for (const v of sp.variants ?? []) {
            const price = Number(v.price);
            if (!v.available || !(price > 0)) continue;
            const m = matchVariant(book, sp, v);
            if (!m) continue;
            for (const id of m.ids) {
              const prev = best.get(id);
              if (!prev || price < prev[0]) best.set(id, [price, `https://${site.domain}/products/${sp.handle}${sp.variants.length > 1 ? `?variant=${v.id}` : ""}`, m.how]);
            }
          }
        }
        rep.products += page.length;
        if (best.size) {
          // Keep the cheaper offer when a product already matched on an earlier page.
          const ids = [...best.keys()];
          const old = (await db.cmd<(string | null)[]>(["HMGET", OFFERS(site.domain), ...ids])) ?? [];
          const flat: string[] = [];
          ids.forEach((id, i) => {
            const [p, u, how] = best.get(id)!;
            const o = old[i] ? Number(old[i]!.split("|")[0]) : Infinity;
            if (p < o) flat.push(id, `${p}|${u}|${how}`);
            if (!old[i]) (rep.matched++, how === "barcode" && rep.byBarcode++);
          });
          if (flat.length) await db.cmd(["HSET", OFFERS(site.domain), ...flat]);
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
    return { more: true, state: st };
  }

  await apply(sites, g.marginPct, st.sites);
  await writeState(null);
  return { more: false, state: null };
}

/** Lowest competitor price per product → what the shop sells at. */
async function apply(sites: PriceMatchSite[], marginPct: number, siteReports: SiteReport[]) {
  const idx = await getIndex();
  const sourcing = await getSourcing();
  const best = new Map<string, { t: number; site: PriceMatchSite; u: string; how: string }>();
  for (const site of sites) {
    if (siteReports.find((r) => r.domain === site.domain)?.error) continue;
    let cursor = "0";
    do {
      const [next, flat] = (await db.cmd<[string, string[]]>(["HSCAN", OFFERS(site.domain), cursor, "COUNT", 2000])) ?? ["0", []];
      for (let i = 0; i < flat.length; i += 2) {
        const [p, u, how] = flat[i + 1].split("|");
        const t = Number(p);
        const prev = best.get(flat[i]);
        if (!prev || t < prev.t) best.set(flat[i], { t, site, u, how });
      }
      cursor = String(next);
    } while (cursor !== "0");
  }

  const prices: string[] = [];
  const flags: Flag[] = [];
  let cheaper = 0, matchedNow = 0;
  for (const [id, b] of best) {
    const p = idx.byId.get(id);
    if (!p || b.t >= p.price - 0.005) continue;
    cheaper++;
    const flag = (why: Flag["why"], floor = 0) => flags.push({ id, name: `${p.brand} ${p.name}${p.variant ? ` · ${p.variant}` : ""}`, ours: p.price, theirs: b.t, floor: r2(floor), site: b.site.label, url: b.u, why });
    // A name match far below our price is more likely a different size or a mistake.
    if (b.how === "name" && b.t < p.price * 0.5) { flag("check match"); continue; }
    if (!p.cost || p.cost <= 0) { flag("no cost"); continue; }
    const rule = sourcing.sources.find((x) => x.source.toLowerCase() === (p.source ?? "").toLowerCase());
    const base = rule?.origin === "international" && rule.pricing ? landed(p.cost, rule.pricing).landed : p.cost;
    const floor = r2(base * (1 + marginPct / 100));
    if (b.t < floor) { flag("below floor", floor); continue; }
    matchedNow++;
    const m: Match = { t: r2(b.t), f: floor, s: b.site.label, show: b.site.showName, u: b.u };
    prices.push(id, JSON.stringify(m));
  }
  await db.cmd(["DEL", PRICES]);
  for (let i = 0; i < prices.length; i += 1000) await db.cmd(["HSET", PRICES, ...prices.slice(i, i + 1000)]);
  await db.cmd(["INCR", VER]);
  flags.sort((a, b) => b.ours - b.theirs - (a.ours - a.theirs));
  const report: Report = { at: new Date().toISOString(), sites: siteReports, matched: best.size, cheaper, matchedNow, flags: flags.slice(0, 300) };
  await db.cmd(["SET", REPORT, JSON.stringify(report)]);
  g.__pm = undefined;
}

export async function getReport(): Promise<{ report: Report | null; running: State | null }> {
  const [raw, running] = await Promise.all([db.cmd<string | null>(["GET", REPORT]), readState()]);
  return { report: raw ? (JSON.parse(raw) as Report) : null, running };
}

// ── What the storefront reads ───────────────────────────────

const g = globalThis as unknown as { __pm?: { ver: string; at: number; map: Map<string, Match> } };

/** Matched prices, cached per server instance and re-checked every minute. */
export async function priceMatches(): Promise<{ ver: string; map: Map<string, Match> }> {
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
    g.__pm = { ver, at: now, map };
  } catch {
    g.__pm = { ver: "0", at: now, map: new Map() };
  }
  return g.__pm;
}
