import "server-only";
import { bfLines } from "@/lib/black-friday";
import { discountFor, rateSource } from "@/lib/costs/neovitale";
import { getMargins } from "@/lib/margins";

export type MarginRow = { brand: string; products: number; inStock: number; rate: number | null | undefined; rateFrom: "edited" | "price list" | "missing"; marginPct: number | null; withCost: number; floorPct: number; brandFloor?: number };

/** One row per brand customers can buy: NeoVitale's rate, our margin now, and the floor that applies. */
export async function marginRows(): Promise<MarginRow[]> {
  const m = await getMargins();
  const lines = await bfLines();
  return lines.map((l) => ({
    brand: l.brand, products: l.products, inStock: l.inStock, rate: discountFor(l.brand, ""), rateFrom: rateSource(l.brand),
    marginPct: l.marginPct, withCost: l.withCost, floorPct: m.brandFloors[l.brand.toLowerCase()] ?? m.floorPct, brandFloor: m.brandFloors[l.brand.toLowerCase()],
  }));
}
