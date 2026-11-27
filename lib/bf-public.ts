import "server-only";
import { bfState, defaultFx, getBanner, type BfFx } from "@/lib/black-friday";
import { liveProducts } from "@/lib/pricing";
import { shopImg } from "@/lib/img-server";
import { memo } from "@/lib/memo";
import { getTaxonomy } from "@/lib/catalog";

// What customers see of Black Friday: the dates, today's spotlight and the doors still to open.
// Future days' products never leave the server. Days follow the Beirut calendar.
const DAY = 864e5;
const TZ = 2 * 3600e3;
const dayNo = (t: number) => Math.floor((t + TZ) / DAY);

export type BfDeal = { slug: string; brand: string; name: string; image?: string; price: number; was?: number; pct: number };
export type BfPublic = {
  phase: "off" | "soon" | "live" | "ended"; startsAt: string; endsAt: string; day: number; days: number; nextUnlock?: string; top?: number;
  fx: BfFx; deal?: BfDeal;
  /** Categories a shopper can pick for their daily deals (only ones with Black Friday discounts), and the one picked. */
  cats?: { slug: string; name: string; count: number }[]; cat?: string;
  doors: { day: number; open: boolean; today: boolean; unlocksAt: string; deal?: BfDeal }[];
};

export async function bfPublic(now = Date.now(), wantCat = ""): Promise<BfPublic> {
  const catKey = wantCat.replace(/[^a-z0-9-]/gi, "").slice(0, 60).toLowerCase();
  return memo(`bf:public:${catKey}:${Math.floor(now / 30000)}`, 30_000, async () => {
    const [b, lines, live] = await Promise.all([getBanner(), bfState(), liveProducts()]);
    const fx = { ...defaultFx, ...b.fx };
    const startsAt = b.startsAt || lines.startsAt, endsAt = b.endsAt || lines.endsAt;
    const s = Date.parse(startsAt), e = Date.parse(endsAt);
    const on = (b.enabled && b.items.some((i) => i.pct > 0)) || lines.enabled;
    if (!on || !startsAt || !endsAt || !(e > s) || now > e + DAY * 2) return { phase: now > e ? "ended" : "off", startsAt, endsAt, day: 0, days: 0, fx, doors: [] };
    const days = dayNo(e - 1) - dayNo(s) + 1;
    const day = now < s ? 0 : Math.min(days, dayNo(now) - dayNo(s) + 1);
    const phase: BfPublic["phase"] = now < s ? "soon" : now < e ? "live" : "ended";
    // Spotlights: the banner picks that have a discount, in the order chosen in the admin, one per day.
    const picks: BfDeal[] = b.items.filter((i) => i.pct > 0).map((i): BfDeal | null => {
      const vs = live.list.filter((p) => p.slug === i.slug && p.inStock);
      const p = vs.sort((a, b2) => a.price - b2.price)[0];
      return p ? { slug: i.slug, brand: p.brand, name: p.name, image: shopImg(p.image), price: p.price, was: p.compareAt && p.compareAt > p.price ? p.compareAt : undefined, pct: i.pct } : null;
    }).filter((x): x is BfDeal => !!x);
    // Deals by the shopper's category: every in-stock product on a Black Friday discount, grouped by category,
    // best discount first with brands mixed, so each day opens a different strong deal in what they love.
    let cats: BfPublic["cats"], cat: string | undefined, catPicks: BfDeal[] = [];
    if (fx.byCategory !== false && fx.daily) {
      const best = new Map<string, BfDeal & { category: string }>();
      for (const p of live.list) {
        if (!p.bf || !p.inStock || !p.compareAt || p.compareAt <= p.price) continue;
        const pct = Math.round((1 - p.price / p.compareAt) * 100);
        const cur = best.get(p.slug);
        if (!cur || p.price < cur.price) best.set(p.slug, { slug: p.slug, brand: p.brand, name: p.name, image: shopImg(p.image), price: p.price, was: p.compareAt, pct, category: p.category });
      }
      const byCat = new Map<string, (BfDeal & { category: string })[]>();
      for (const d of best.values()) { const l = byCat.get(d.category) ?? []; l.push(d); byCat.set(d.category, l); }
      const tax = await getTaxonomy();
      cats = [...byCat.entries()].filter(([, l]) => l.length >= 2).sort((x, y) => y[1].length - x[1].length).slice(0, 8)
        .map(([slug, l]) => ({ slug, name: tax.categories.find((c) => c.slug === slug)?.name ?? slug, count: l.length }));
      if (catKey && byCat.has(catKey) && cats.some((c) => c.slug === catKey)) {
        cat = catKey;
        const sorted = byCat.get(catKey)!.sort((x, y) => y.pct - x.pct);
        // mix brands: take the best of each brand in turn
        const seen = new Map<string, number>();
        catPicks = sorted.map((d) => { const n = seen.get(d.brand) ?? 0; seen.set(d.brand, n + 1); return { d, n }; }).sort((x, y) => x.n - y.n || y.d.pct - x.d.pct).map(({ d }) => ({ slug: d.slug, brand: d.brand, name: d.name, image: d.image, price: d.price, was: d.was, pct: d.pct }));
      }
    }
    const pool = catPicks.length ? catPicks : picks;
    const doors = Array.from({ length: days }, (_, k) => {
      const d = k + 1;
      const unlocks = (dayNo(s) + k) * DAY - TZ;
      const open = phase !== "soon" && d <= day;
      return { day: d, open, today: phase === "live" && d === day, unlocksAt: new Date(Math.max(unlocks, s)).toISOString(), deal: open && pool.length ? pool[k % pool.length] : undefined };
    });
    const nextUnlock = phase === "live" && day < days ? new Date((dayNo(now) + 1) * DAY - TZ).toISOString() : undefined;
    const top = Math.max(0, ...(b.enabled ? b.items.map((i) => i.pct) : []), ...(lines.enabled ? Object.values(lines.pct) : []));
    return { phase, startsAt, endsAt, day, days, nextUnlock, top, fx, cats, cat, deal: phase === "live" && pool.length ? pool[(day - 1) % pool.length] : undefined, doors };
  });
}

/** Stamp card: a delivered order placed on a Black Friday day earns that day's stamp; every day stamped earns the bonus. */
export async function awardBfStamp(order: { id: string; createdAt: string; customer: { phone: string } }) {
  const [b, lines] = await Promise.all([getBanner(), bfState()]);
  const fx = { ...defaultFx, ...b.fx };
  if (!fx.stamps) return;
  const s = Date.parse(b.startsAt || lines.startsAt), e = Date.parse(b.endsAt || lines.endsAt), t = Date.parse(order.createdAt);
  if (!(t >= s && t < e)) return;
  const days = dayNo(e - 1) - dayNo(s) + 1;
  const d = dayNo(t) - dayNo(s) + 1;
  const year = new Date(s).getUTCFullYear();
  const gs = await import("@/lib/growth-store");
  let m = await gs.addPoints(order.customer.phone, fx.stampPoints, `Black Friday stamp: day ${d} of ${days}`, `bfstamp:${year}:${d}`);
  const got = (m?.bonuses ?? []).filter((x) => x.startsWith(`bfstamp:${year}:`)).length;
  if (m && got >= days) m = await gs.addPoints(order.customer.phone, fx.stampBonus, `Black Friday: all ${days} stamps collected`, `bfstamp:${year}:all`);
}
