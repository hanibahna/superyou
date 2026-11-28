import "server-only";
import { bfLines } from "@/lib/black-friday";
import { getMargins } from "@/lib/margins";
import { getGrowth } from "@/lib/growth-store";
import { getPromotions } from "@/lib/site-store";
import { isLive, type Discount } from "@/lib/site";
import { subPct } from "@/lib/every";

export type RoomRow = {
  brand: string; products: number; inStock: number; marginPct: number | null; floorPct: number;
  /** Most % off the brand can take on average before reaching the minimum margin (null = no cost on file). */
  room: number | null; sale: number; bf: number; sub: number;
};

/** Largest % off price that keeps margin at the floor: (m − f) / (1 − f). */
export const roomFor = (marginPct: number | null, floorPct: number) =>
  marginPct == null ? null : Math.max(0, Math.floor(((marginPct - floorPct) / (100 - floorPct)) * 100));

const applies = (d: Discount, brand: string) => {
  const b = brand.toLowerCase();
  const inS = (s: Discount["scope"]) => s.kind === "all" || (s.kind === "brand" && s.values.some((v) => v.toLowerCase() === b));
  const ex = d.exclude?.kind === "brand" && d.exclude.values.some((v) => v.toLowerCase() === b);
  return inS(d.scope) && !ex;
};

export async function roomRows(): Promise<{ rows: RoomRow[]; codes: Discount[]; otherSales: Discount[] }> {
  const [m, lines, g, promos] = await Promise.all([getMargins(), bfLines(), getGrowth(), getPromotions()]);
  const auto = promos.discounts.filter((d) => !d.code && d.type === "percent" && isLive(d));
  const subDefault = g.subscribe.enabled ? subPct(g.subscribe) : 0;
  const rows = lines.map((l) => {
    const key = l.brand.toLowerCase();
    const floorPct = m.brandFloors[key] ?? m.floorPct;
    const sale = Math.max(0, ...auto.filter((d) => applies(d, l.brand)).map((d) => d.value));
    return { brand: l.brand, products: l.products, inStock: l.inStock, marginPct: l.marginPct, floorPct, room: roomFor(l.marginPct, floorPct), sale, bf: l.bfPct, sub: g.subscribe.enabled ? m.subPct[key] ?? subDefault : 0 };
  });
  return {
    rows,
    codes: promos.discounts.filter((d) => d.code),
    otherSales: promos.discounts.filter((d) => !d.code && isLive(d) && !["all", "brand"].includes(d.scope.kind)),
  };
}

/** brand (lowercase) → margin room %, for hints on the discount screens. */
export async function roomByBrand(): Promise<Record<string, number | null>> {
  const [m, lines] = await Promise.all([getMargins(), bfLines()]);
  return Object.fromEntries(lines.map((l) => [l.brand.toLowerCase(), roomFor(l.marginPct, m.brandFloors[l.brand.toLowerCase()] ?? m.floorPct)]));
}
