import "server-only";
import { getIndex, getTaxonomy } from "@/lib/catalog";
import { liveProducts } from "@/lib/pricing";
import { getMargins, floorPrice } from "@/lib/margins";
import { getPromotions } from "@/lib/site-store";
import { inScope, isLive, type Discount, type Scope } from "@/lib/site";
import { BF, BFI } from "@/lib/black-friday";

export type RuleStatus = {
  id: string; name: string; kind: "Automatic sale" | "Black Friday" | "Min-spend discount" | "Promo code";
  value: string; scope: string; exceptions: string; state: "Live" | "Off" | "Scheduled" | "Ended" | "Used up" | "Paused";
  covers: number; wins: number; capped: number; onSale?: number; stack?: boolean; warnings: string[];
};

const excl = (p: Parameters<typeof inScope>[0], s: Scope) => s.values.length > 0 && s.kind !== "all" && inScope(p, s);

/** Every discount rule with what it really does right now: products it covers, where it wins, where the
 *  minimum margin cuts it, and anything that looks wrong. */
export async function discountStatus() {
  const [promos, live, idx, tax, m] = await Promise.all([getPromotions(), liveProducts(), getIndex(), getTaxonomy(), getMargins()]);
  const now = Date.now();
  const base = live.list.map((lp) => idx.byId.get(lp.id) ?? lp).filter((p) => p.price > 0);
  const brands = new Set(base.map((p) => p.brand.toLowerCase()));
  const cats = new Set(tax.categories.map((c) => c.slug));
  const concerns = new Set(tax.concerns.map((c) => c.slug));
  const skus = new Set(base.map((p) => p.sku.toLowerCase()));
  const nameOf = (s: Scope) => s.kind === "all" ? "Everything" : s.values.length ? `${s.kind}: ${s.values.slice(0, 4).map((v) => s.kind === "category" ? tax.categories.find((c) => c.slug === v)?.name ?? v : s.kind === "concern" ? tax.concerns.find((c) => c.slug === v)?.name ?? v : v).join(", ")}${s.values.length > 4 ? ` +${s.values.length - 4}` : ""}` : `${s.kind}: none chosen`;
  const unknown = (s: Scope) => s.values.filter((v) => (s.kind === "brand" && !brands.has(v.toLowerCase())) || (s.kind === "category" && !cats.has(v)) || (s.kind === "concern" && !concerns.has(v)) || (s.kind === "skus" && !skus.has(v.toLowerCase())));

  const autoLive = promos.paused ? [] : promos.discounts.filter((d) => !d.code && d.minSubtotal === 0 && isLive(d, now));
  // Which automatic rule each product actually gets (the lowest price wins).
  const winner = new Map<string, { id: string; capped: boolean }>();
  for (const p of base) {
    let best = p.price, rule: Discount | undefined;
    for (const d of autoLive) {
      if (!inScope(p, d.scope) || excl(p, d.exclude)) continue;
      const price = Math.max(0, d.type === "percent" ? p.price * (1 - d.value / 100) : p.price - d.value);
      if (price < best) (best = price), (rule = d);
    }
    if (rule) { const f = floorPrice(p, m); winner.set(p.id, { id: rule.id, capped: f !== undefined && best < f - 0.005 }); }
  }

  const codeCount = new Map<string, number>();
  for (const d of promos.discounts) if (d.code) codeCount.set(d.code.toLowerCase(), (codeCount.get(d.code.toLowerCase()) ?? 0) + 1);

  const rules: RuleStatus[] = promos.discounts.map((d) => {
    const kind: RuleStatus["kind"] = d.code ? "Promo code" : (d.id.startsWith(BF) || d.id.startsWith(BFI)) ? "Black Friday" : d.minSubtotal > 0 ? "Min-spend discount" : "Automatic sale";
    const ended = !!d.endsAt && Date.parse(d.endsAt) <= now;
    const state: RuleStatus["state"] = !d.enabled ? "Off" : ended ? "Ended" : d.startsAt && Date.parse(d.startsAt) > now ? "Scheduled" : d.code && d.usageLimit > 0 && d.used >= d.usageLimit ? "Used up" : promos.paused ? "Paused" : "Live";
    const inS = base.filter((p) => inScope(p, d.scope));
    const covered = inS.filter((p) => !excl(p, d.exclude));
    const isAuto = kind === "Automatic sale" || kind === "Black Friday";
    const wins = isAuto ? covered.filter((p) => winner.get(p.id)?.id === d.id).length : 0;
    const capped = isAuto ? covered.filter((p) => winner.get(p.id)?.id === d.id && winner.get(p.id)!.capped).length
      : covered.filter((p) => { const f = floorPrice(p, m); const off = d.type === "percent" ? p.price * d.value / 100 : d.value; return f !== undefined && p.price - off < f - 0.005; }).length;
    const onSale = !isAuto ? covered.filter((p) => winner.has(p.id)).length : undefined;
    const w: string[] = [];
    if (!covered.length) w.push(inS.length ? "Its exceptions remove every product it covers" : "Covers no product on sale in the shop");
    const unk = unknown(d.scope); if (unk.length) w.push(`Not found in the shop: ${unk.slice(0, 5).join(", ")}${unk.length > 5 ? "…" : ""}`);
    const unkX = unknown(d.exclude); if (unkX.length) w.push(`Exception not found in the shop: ${unkX.slice(0, 5).join(", ")}`);
    if (d.exclude.kind !== "all" && d.exclude.values.length && inS.length === covered.length) w.push("Its exception doesn't remove any product");
    if (d.scope.kind !== "all" && d.scope.values.length === 0) w.push(`Applies to "${d.scope.kind}" but nothing is picked`);
    if (d.enabled && ended) w.push("Still switched on but its end date has passed");
    if (d.code && (codeCount.get(d.code.toLowerCase()) ?? 0) > 1) w.push("Another rule uses the same code: only the first one works");
    if (isAuto && state === "Live" && covered.length && !wins) w.push("Never used: a bigger sale wins on every product it covers");
    else if (isAuto && state === "Live" && wins < covered.length) w.push(`${covered.length - wins} of its products get a bigger sale instead`);
    if (capped) w.push(`${capped} product${capped === 1 ? "" : "s"} capped at the minimum margin (customers get less than ${d.type === "percent" ? `${d.value}%` : `$${d.value}`})`);
    if (d.code && !d.stack && onSale) w.push(`Doesn't add to sale prices: skips ${onSale} product${onSale === 1 ? "" : "s"} already on sale`);
    if (d.type === "percent" && d.value >= 50) w.push(`${d.value}% off is very high`);
    if (d.type === "fixed" && covered.some((p) => p.price <= d.value)) w.push(`$${d.value} off is more than the price of some products`);
    return { id: d.id, name: d.name, kind, value: d.type === "percent" ? `${d.value}%` : `$${d.value} each`, scope: nameOf(d.scope) + (d.minSubtotal ? ` · min $${d.minSubtotal}` : ""), exceptions: d.exclude.kind === "all" || !d.exclude.values.length ? "–" : nameOf(d.exclude), state, covers: covered.length, wins, capped, onSale, stack: d.code ? d.stack : undefined, warnings: w };
  });

  const regrouped = base.filter((p) => p.feedCategory).length;
  return { paused: !!promos.paused, rules, onSale: winner.size, cappedTotal: [...winner.values()].filter((x) => x.capped).length, products: base.length, floorPct: m.floorPct, regrouped };
}
