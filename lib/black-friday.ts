import "server-only";
import { getIndex } from "@/lib/catalog";
import { getLanding, getPromotions, savePromotions } from "@/lib/site-store";
import { liveProducts } from "@/lib/pricing";
import { cardsFor } from "@/lib/listing";
import { isLive, type Discount } from "@/lib/site";
import type { ProductLite } from "@/lib/data/catalog";

// Black Friday by product line (= brand). Each line's discount is stored as an automatic,
// brand-scoped discount with an id starting "bf-", so the shop, cart and checkout price it
// like any other sale. Only the admin sees sources, costs and margins.
export const BF = "bf-";
const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number) => Math.round(n * 1000) / 10;
const key = (b: string) => b.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const SRC: Record<string, string> = { "neovitale.com": "NeoVitale", "skinsociety.me": "Skin Society", "nexuscare.me": "NexusCare" };
export const srcName = (s?: string) => (s ? SRC[s] ?? s : "Own stock");

export type BfLine = {
  brand: string; products: number; inStock: number; sources: Record<string, number>;
  withCost: number; regular: number; cost: number; marginPct: number | null;
  bfPct: number; bfMarginPct: number | null; belowCost: number;
};

export async function bfState() {
  const promos = await getPromotions();
  const bf = promos.discounts.filter((d) => d.id.startsWith(BF));
  const first = bf[0];
  return { startsAt: first?.startsAt ?? "", endsAt: first?.endsAt ?? "", enabled: bf.some((d) => d.enabled), pct: Object.fromEntries(bf.map((d) => [(d.scope.values[0] ?? "").toLowerCase(), d.value])) as Record<string, number> };
}

/** Margin per line at our regular price (before any sale), and after the Black Friday discount set for it. */
export async function bfLines(): Promise<BfLine[]> {
  const [idx, state, live] = await Promise.all([getIndex(), bfState(), liveProducts()]);
  // Only what customers can buy (hidden catalogs, hidden brands and merged duplicates left out), at our regular price.
  const by = new Map<string, ProductLite[]>();
  for (const lp of live.list) { const p = idx.byId.get(lp.id); if (p && p.price > 0 && p.brand) (by.get(p.brand) ?? by.set(p.brand, []).get(p.brand)!).push(p); }
  const out: BfLine[] = [];
  for (const [brand, ps] of by) {
    const d = state.pct[brand.toLowerCase()] ?? 0;
    const sources: Record<string, number> = {};
    let regular = 0, cost = 0, withCost = 0, below = 0;
    for (const p of ps) {
      sources[srcName(p.source)] = (sources[srcName(p.source)] ?? 0) + 1;
      // A cost equal to or above the price is a placeholder, not a real purchase price.
      if (typeof p.cost === "number" && p.cost > 0 && p.cost < p.price) {
        withCost++; regular += p.price; cost += p.cost;
        if (p.price * (1 - d / 100) < p.cost - 0.005) below++;
      }
    }
    const after = regular * (1 - d / 100);
    out.push({ brand, products: ps.length, inStock: ps.filter((p) => p.inStock).length, sources, withCost, regular: r2(regular), cost: r2(cost),
      marginPct: regular ? pct((regular - cost) / regular) : null, bfPct: d, bfMarginPct: after ? pct((after - cost) / after) : null, belowCost: below });
  }
  return out.sort((a, b) => b.inStock - a.inStock);
}

/** What the Black Friday banner on the homepage shows right now, and where each discount comes from. */
export async function bannerReport() {
  const [landing, idx, live, promos] = await Promise.all([getLanding(), getIndex(), liveProducts(), getPromotions()]);
  const auto = promos.discounts.filter((d) => !d.code && d.minSubtotal === 0 && isLive(d));
  const words = (t: string) => t.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const why = (p?: ProductLite) => !p ? "product deleted" : p.status !== "active" ? "product hidden (draft)" : !live.byId.has(p.id) ? (live.list.some((x) => x.slug === p.slug) ? "" : "hidden from customers (its catalog or brand is hidden, or a duplicate)") : "";
  const altFor = (p: ProductLite) => { const w = words(p.name).slice(0, 4); return live.list.find((x) => x.inStock && x.brand.toLowerCase() === p.brand.toLowerCase() && w.every((k) => words(x.name).includes(k)) && (!p.variant || !x.variant || words(x.variant).join("") === words(p.variant).join(""))); };
  const rows: { pageWorks?: boolean; problem?: string; alternative?: string; banner: string; name: string; brand: string; source: string; neovitale: boolean; regular: number; was?: number; now: number; offPct: number; basis: string; cost?: number; marginNowPct: number | null }[] = [];
  for (const s of landing.sections) {
    if (s.type !== "bfhero" || !s.enabled) continue;
    // The picture tiles (each links to a product) and the sliding product row.
    const tileSlugs = s.images.map((t) => /\/products\/([^/?#]+)/.exec(t.href ?? "")?.[1]).filter((x): x is string => !!x).map((x) => decodeURIComponent(x));
    const tiles = tileSlugs.flatMap((slug) => { const vs = live.list.filter((p) => p.slug === slug); const raw = idx.all.filter((p) => p.slug === slug); return vs.length ? [vs.find((v) => v.inStock) ?? vs[0]] : raw.length ? [raw[0]] : []; });
    const slid = s.slider?.enabled ? (await cardsFor(s.slider.source, s.slider.limit * 2, "featured")).filter((c) => c.image && c.inStock).slice(0, s.slider.limit) : [];
    for (const c of [...tiles, ...slid]) {
      const raw = idx.byId.get(c.id);
      const lp = live.byId.get(c.id) ?? c;
      const was = lp.compareAt && lp.compareAt > lp.price ? lp.compareAt : lp.matchWas;
      const rule = auto.find((d) => d.scope && raw && lp.price < raw.price - 0.005 && Math.abs(lp.price - (d.type === "percent" ? raw.price * (1 - d.value / 100) : raw.price - d.value)) < 0.02);
      const basis = lp.matchWas ? `Price guarantee: matched a cheaper shop ($${lp.matchVs})`
        : rule ? `Automatic discount "${rule.name}" (${rule.type === "percent" ? `${rule.value}%` : `$${rule.value}`})`
        : raw?.compareAt && raw.compareAt > raw.price ? `Sale price copied from ${srcName(raw.source)} at import (their crossed-out price $${raw.compareAt})`
        : "No discount";
      const cost = raw?.cost;
      const isTile = tiles.includes(c as ProductLite);
      const problem = isTile ? why(raw) : "";
      const alt = problem && raw ? altFor(raw) : undefined;
      rows.push({ pageWorks: isTile ? !problem : undefined, problem: problem || undefined, alternative: alt ? `/products/${alt.slug}/ (${srcName(alt.source)}, $${alt.price})` : undefined, banner: tiles.includes(c as ProductLite) ? "Picture tile" : "Product slider", name: `${c.name}${c.variant ? ` · ${c.variant}` : ""}`, brand: c.brand, source: srcName(raw?.source), neovitale: raw?.source === "neovitale.com",
        regular: r2(raw?.price ?? lp.price), was: was ? r2(was) : undefined, now: r2(lp.price), offPct: was ? Math.round((1 - lp.price / was) * 100) : 0, basis,
        cost: cost ? r2(cost) : undefined, marginNowPct: cost ? pct((lp.price - cost) / lp.price) : null });
    }
  }
  const sec = landing.sections.find((x) => x.type === "bfhero" && x.enabled);
  return { headline: sec && sec.type === "bfhero" ? `${sec.eyebrow} · ${sec.title.replace(/\*/g, "")}` : "", onSaleNow: live.list.filter((p) => p.inStock && (p.compareAt ?? 0) > p.price).length, rows };
}

/** Replace the Black Friday discounts: one automatic discount per line with a % above 0. */
export async function saveBf(input: { startsAt: string; endsAt: string; enabled: boolean; pct: Record<string, number> }) {
  const promos = await getPromotions();
  const keep = promos.discounts.filter((d) => !d.id.startsWith(BF));
  const lines: Discount[] = Object.entries(input.pct).filter(([, v]) => v > 0 && v < 100).map(([brand, v]) => ({
    id: `${BF}${key(brand)}`, name: `Black Friday: ${v}% off ${brand}`, enabled: input.enabled, type: "percent", value: v,
    scope: { kind: "brand", values: [brand] }, exclude: { kind: "skus", values: [] }, code: "", minSubtotal: 0,
    startsAt: input.startsAt, endsAt: input.endsAt, stack: false, usageLimit: 0, used: 0,
  }));
  await savePromotions({ ...promos, discounts: [...keep, ...lines] });
  return lines.length;
}
