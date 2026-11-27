import "server-only";
import { bfState, defaultFx, getBanner, type BfFx } from "@/lib/black-friday";
import { liveProducts } from "@/lib/pricing";
import { shopImg } from "@/lib/img-server";
import { memo } from "@/lib/memo";

// What customers see of Black Friday: the dates, today's spotlight and the doors still to open.
// Future days' products never leave the server. Days follow the Beirut calendar.
const DAY = 864e5;
const TZ = 2 * 3600e3;
const dayNo = (t: number) => Math.floor((t + TZ) / DAY);

export type BfDeal = { slug: string; brand: string; name: string; image?: string; price: number; was?: number; pct: number };
export type BfPublic = {
  phase: "off" | "soon" | "live" | "ended"; startsAt: string; endsAt: string; day: number; days: number; nextUnlock?: string;
  fx: BfFx; deal?: BfDeal; doors: { day: number; open: boolean; today: boolean; unlocksAt: string; deal?: BfDeal }[];
};

export async function bfPublic(now = Date.now()): Promise<BfPublic> {
  return memo(`bf:public:${Math.floor(now / 30000)}`, 30_000, async () => {
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
    const doors = Array.from({ length: days }, (_, k) => {
      const d = k + 1;
      const unlocks = (dayNo(s) + k) * DAY - TZ;
      const open = phase !== "soon" && d <= day;
      return { day: d, open, today: phase === "live" && d === day, unlocksAt: new Date(Math.max(unlocks, s)).toISOString(), deal: open && picks.length ? picks[k % picks.length] : undefined };
    });
    const nextUnlock = phase === "live" && day < days ? new Date((dayNo(now) + 1) * DAY - TZ).toISOString() : undefined;
    return { phase, startsAt, endsAt, day, days, nextUnlock, fx, deal: phase === "live" && picks.length ? picks[(day - 1) % picks.length] : undefined, doors };
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
