import "server-only";
import { getIndex } from "@/lib/catalog";
import { getLanding, getPromotions, savePromotions } from "@/lib/site-store";
import { liveProducts } from "@/lib/pricing";
import { cardsFor } from "@/lib/listing";
import { isLive, type Discount } from "@/lib/site";
import type { ProductLite } from "@/lib/data/catalog";
import { db } from "@/lib/db-core";
import { saveLanding } from "@/lib/site-store";
import type { Tile } from "@/lib/site";

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

// ── The homepage Black Friday banner: hand-picked products, each with its own discount ──

export const BFI = "bfi-";
export type BannerItem = { slug: string; pct: number };
/** Animations and games tied to the Black Friday dates. Stamps cost money (Club points), so they start off. */
export type BfFx = { strip: boolean; daily: boolean; confetti: boolean; stamps: boolean; stampPoints: number; stampBonus: number; byCategory?: boolean };
export const defaultFx: BfFx = { strip: true, daily: true, confetti: true, stamps: false, stampPoints: 20, stampBonus: 100, byCategory: true };
export type Banner = { items: BannerItem[]; startsAt: string; endsAt: string; enabled: boolean; headline: boolean; fx?: BfFx };
const BANNER = "bf:banner";

export type Candidate = { slug: string; brand: string; name: string; image?: string; price: number; cost?: number; maxMarginPct: number | null; inStock: boolean; variants: number };

/** One product (all its sizes/shades) as the admin sees it: our regular price and the best margin we have on it. */
function candidateOf(slug: string, rawVariants: ProductLite[]): Candidate | null {
  const vs = rawVariants.filter((v) => v.price > 0);
  if (!vs.length) return null;
  const pick = vs.find((v) => v.inStock) ?? vs[0];
  const margins = vs.filter((v) => v.cost && v.cost > 0 && v.cost < v.price).map((v) => (v.price - v.cost!) / v.price);
  return { slug, brand: pick.brand, name: pick.name, image: pick.image, price: r2(pick.price), cost: pick.cost && pick.cost < pick.price ? r2(pick.cost) : undefined,
    maxMarginPct: margins.length ? pct(Math.max(...margins)) : null, inStock: vs.some((v) => v.inStock), variants: vs.length };
}

export async function getBanner(): Promise<Banner> {
  const raw = await db.cmd<string | null>(["GET", BANNER]).catch(() => null);
  if (raw) return JSON.parse(raw) as Banner;
  // First time: start from the banner's current picture tiles that customers can actually buy.
  const [landing, live, state] = await Promise.all([getLanding(), liveProducts(), bfState()]);
  const sec = landing.sections.find((s) => s.type === "bfhero");
  const slugs = sec && sec.type === "bfhero" ? sec.images.map((t) => /\/products\/([^/?#]+)/.exec(t.href ?? "")?.[1]).filter((x): x is string => !!x).map((x) => decodeURIComponent(x)) : [];
  return { items: slugs.filter((s) => live.list.some((p) => p.slug === s)).map((slug) => ({ slug, pct: 0 })), startsAt: state.startsAt || "", endsAt: state.endsAt || "", enabled: true, headline: true };
}

export async function bannerItems(b: Banner) {
  const idx = await getIndex();
  return b.items.map((it) => ({ ...it, ...candidateOf(it.slug, idx.all.filter((p) => p.slug === it.slug)) })).filter((x) => x.price);
}

/** Products customers can buy, matching a search, with their margin, for picking banner items. */
export async function searchCandidates(q: string): Promise<Candidate[]> {
  const words = q.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const [idx, live] = await Promise.all([getIndex(), liveProducts()]);
  const slugs: string[] = [];
  for (const p of live.list) {
    if (slugs.length >= 40) break;
    const hay = `${p.brand} ${p.name}`.toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]+/g, " ");
    if (!slugs.includes(p.slug) && words.every((w) => hay.includes(w))) slugs.push(p.slug);
  }
  const liveIds = new Set(live.list.map((p) => p.id));
  return slugs.map((s) => candidateOf(s, idx.all.filter((p) => p.slug === s && liveIds.has(p.id)))).filter((c): c is Candidate => !!c).sort((a, b) => Number(b.inStock) - Number(a.inStock));
}

/** Save the banner: per-item automatic discounts, the banner's picture tiles and product row, and (optionally) a headline that matches the biggest discount. */
export async function saveBanner(b: Banner) {
  const [idx, promos, landing, lines, settings] = await Promise.all([getIndex(), getPromotions(), getLanding(), bfState(), (await import("@/lib/site-store")).getSettings()]);
  const items = b.items.filter((it) => idx.all.some((p) => p.slug === it.slug));
  const discounts: Discount[] = items.filter((it) => it.pct > 0 && it.pct < 100).map((it) => {
    const vs = idx.all.filter((p) => p.slug === it.slug);
    return { id: `${BFI}${it.slug}`.slice(0, 80), name: `Black Friday: ${it.pct}% off ${vs[0].brand} ${vs[0].name}`.slice(0, 120), enabled: b.enabled, type: "percent", value: it.pct,
      scope: { kind: "skus", values: vs.map((v) => v.sku) }, exclude: { kind: "skus", values: [] }, code: "", minSubtotal: 0, startsAt: b.startsAt, endsAt: b.endsAt, stack: false, usageLimit: 0, used: 0 };
  });
  await savePromotions({ ...promos, discounts: [...promos.discounts.filter((d) => !d.id.startsWith(BFI)), ...discounts] });
  const tiles: Tile[] = items.slice(0, 6).map((it) => {
    const p = idx.all.find((x) => x.slug === it.slug)!;
    return { image: p.image ?? "", title: p.brand, text: p.name, cta: "Shop now", href: `/products/${it.slug}/`, bg: "#f5f0eb", badge: it.pct > 0 ? `-${it.pct}%` : "" };
  });
  const top = Math.max(0, ...(b.enabled ? items.map((i) => i.pct) : []), ...(lines.enabled ? Object.values(lines.pct) : []));
  const sections = landing.sections.map((s) => s.type !== "bfhero" ? s : {
    ...s, images: tiles,
    slider: { enabled: items.length >= 4, source: { kind: "skus" as const, value: items.map((i) => i.slug).join(",") }, limit: Math.max(3, Math.min(24, items.length)), interval: s.slider?.interval ?? 3.5 },
    // Headline, ticker and text say only what is true: the real biggest discount, the real free-delivery threshold, the real end date.
    ...(b.headline ? (() => {
      const offer = top > 0 ? `Up to ${top}% off` : "Our Black Friday picks";
      const ends = b.endsAt ? new Date(b.endsAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Beirut" }) : "";
      return {
        title: top > 0 ? `Up to *${top}%* off` : "Our Black Friday picks",
        badge: ["Black Friday", offer, `Free delivery over $${settings.delivery.freeThreshold}`, "Book a free skin diagnosis"].filter(Boolean).join(" · "),
        text: top > 0 ? `Original skincare, make up, fragrance and pharmacy favourites${(b.fx?.daily ?? true) ? ", with a new deal unlocking every day" : ""}.${ends ? ` Ends ${ends}.` : ""}` : `Skin care, make up, fragrance and pharmacy favourites.${ends ? ` Ends ${ends}.` : ""}`,
        eyebrow: top > 0 ? "Black Friday is on" : "Black Friday 2026",
      };
    })() : {}),
    ...(b.endsAt ? { endsAt: b.endsAt } : {}),
    // The banner's button opens every product on a Black Friday discount (banner picks and brand discounts).
    ...((b.enabled && items.some((i) => i.pct > 0)) || lines.enabled ? { cta: "Shop Black Friday", href: "/shop/?bf=1" } : s.href === "/shop/?bf=1" ? { cta: "Shop now", href: "/shop/" } : {}),
  });
  await saveLanding({ ...landing, sections });
  // The announcement bar at the top of every page says the same true number.
  if (b.headline && /up to\s*\d+\s*%\s*off/i.test(settings.announcement.text)) {
    const { saveSettings } = await import("@/lib/site-store");
    const text = top > 0 ? settings.announcement.text.replace(/up to\s*\d+\s*%\s*off/gi, `Up to ${top}% off`) : settings.announcement.text.replace(/\s*·?\s*up to\s*\d+\s*%\s*off\s*·?/gi, " · ").replace(/^\s*·\s*|\s*·\s*$/g, "").trim();
    await saveSettings({ ...settings, announcement: { ...settings.announcement, text } });
  }
  await db.cmd(["SET", BANNER, JSON.stringify({ ...b, items })]);
  return { items: items.length, discounts: discounts.length, headline: top };
}
