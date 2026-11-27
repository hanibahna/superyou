import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getIndex, getProductsDetailed, saveProducts } from "@/lib/catalog";
import { getMargins } from "@/lib/margins";
import { discountFor, NEOVITALE_DISCOUNTS } from "@/lib/costs/neovitale";

export const maxDuration = 300;

// Supplier costs for the NeoVitale catalog: cost = NeoVitale retail × (1 − brand discount).
// GET = preview; GET ?apply=1 = save. Products of brands not on the list keep no cost.
export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  await getMargins(); // NeoVitale rates edited in Admin → Margins
  const apply = req.nextUrl.searchParams.has("apply");
  const idx = await getIndex();
  const neo = idx.all.filter((p) => p.source === "neovitale.com");
  const set = new Map<string, number>();
  const hit = new Set<string>();
  const byBrand = new Map<string, { n: number; pct: number | null | undefined }>();
  for (const p of neo) {
    const pct = discountFor(p.brand, p.name, hit);
    const prev = byBrand.get(p.brand);
    byBrand.set(p.brand, { n: (prev?.n ?? 0) + 1, pct: typeof prev?.pct === "number" ? prev.pct : pct });
    if (typeof pct === "number" && p.price > 0) set.set(p.id, +(p.price * (1 - pct / 100)).toFixed(2));
  }
  if (apply) {
    const ids = [...set.keys()];
    for (let i = 0; i < ids.length; i += 500) {
      const part = await getProductsDetailed(ids.slice(i, i + 500));
      await saveProducts(part.map((p) => ({ ...p, cost: set.get(p.id) })));
    }
  }
  const brands = [...byBrand].sort((a, b) => b[1].n - a[1].n);
  return NextResponse.json({
    applied: apply, neovitaleProducts: neo.length, withCost: set.size,
    brandsMatched: brands.filter(([, v]) => typeof v.pct === "number").length,
    listNotFound: NEOVITALE_DISCOUNTS.map(([k]) => k).filter((k) => !hit.has(k)),
    allBrands: brands.map(([b, v]) => `${b} (${v.n})`),
    noCost: brands.filter(([, v]) => typeof v.pct !== "number").map(([b, v]) => `${b} (${v.n})`),
  });
}
