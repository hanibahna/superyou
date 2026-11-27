import "server-only";
import { db } from "@/lib/db-core";
import { setNeoOverrides } from "@/lib/costs/neovitale";

// Admin → Margins: the store-wide minimum margin (no discount may go under it), per-brand floors,
// and edits to NeoVitale's discount per brand (= our cost). Margin = (price − cost) ÷ price.
export type Margins = { floorPct: number; brandFloors: Record<string, number>; neoRates: Record<string, number | null> };
export const defaultMargins: Margins = { floorPct: 10, brandFloors: {}, neoRates: {} };
const KEY = "margins";
const g = globalThis as unknown as { __margins?: { at: number; v: Margins } };

export async function getMargins(): Promise<Margins> {
  if (g.__margins && Date.now() - g.__margins.at < 15000) return g.__margins.v;
  let v = defaultMargins;
  try { const raw = await db.cmd<string | null>(["GET", KEY]); if (raw) v = { ...defaultMargins, ...(JSON.parse(raw) as Margins) }; } catch { /* keep defaults */ }
  setNeoOverrides(v.neoRates);
  g.__margins = { at: Date.now(), v };
  return v;
}
export async function saveMargins(v: Margins) {
  await db.cmd(["SET", KEY, JSON.stringify(v)]);
  setNeoOverrides(v.neoRates);
  g.__margins = { at: Date.now(), v };
}

/** Lowest price a product may be sold at under any discount, or undefined when its cost is unknown. */
export function floorPrice(p: { brand: string; cost?: number; price: number }, m: Margins): number | undefined {
  if (!(typeof p.cost === "number" && p.cost > 0 && p.cost < p.price)) return undefined;
  const f = Math.min(90, m.brandFloors[p.brand.toLowerCase()] ?? m.floorPct);
  return Math.ceil((p.cost / (1 - f / 100)) * 100) / 100;
}
