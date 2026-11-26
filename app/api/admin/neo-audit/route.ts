import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getIndex } from "@/lib/catalog";
import { discountFor } from "@/lib/costs/neovitale";
import { fetchSourcePage } from "@/lib/import/shopify-source";

export const maxDuration = 300;

// Read-only audit of the NeoVitale catalog: our prices and costs against NeoVitale's live site.
// NeoVitale's advertised base price = its "was" price when on sale, otherwise its price.
// Correct cost = that base × (1 − the brand's discount on NeoVitale's sheet). Nothing is changed.
// GET → summary by brand; GET ?csv=1 → one row per product.
export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const origin = new URL("https://neovitale.com");
  const live = new Map<string, { price: number; compare: number; available: boolean }>();
  for (let page = 1; page < 200; page++) {
    const list = await fetchSourcePage(origin, page);
    if (!list.length) break;
    for (const p of list) for (const v of p.variants) live.set(String(v.id), { price: Number(v.price), compare: v.compare_at_price ? Number(v.compare_at_price) : 0, available: !!v.available });
  }
  const idx = await getIndex();
  const neo = idx.all.filter((p) => p.source === "neovitale.com");
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const rows = neo.map((p) => {
    const vid = (p.sku ?? "").split("-").pop() ?? "";
    const nv = live.get(vid);
    const pct = discountFor(p.brand, p.name);
    const base = nv ? (nv.compare > nv.price ? nv.compare : nv.price) : undefined;
    const correctCost = base !== undefined && typeof pct === "number" ? r2(base * (1 - pct / 100)) : undefined;
    const ourBase = p.compareAt && p.compareAt > p.price ? p.compareAt : p.price;
    return {
      sku: p.sku, brand: p.brand, name: p.name, variant: p.variant ?? "", status: p.status, inStock: p.inStock,
      ourPrice: p.price, ourWas: p.compareAt ?? null, ourCost: p.cost ?? null,
      nvPrice: nv?.price ?? null, nvWas: nv && nv.compare > nv.price ? nv.compare : null, nvBase: base ?? null, nvOnSale: !!(nv && nv.compare > nv.price),
      discountPct: typeof pct === "number" ? pct : pct === null ? "1+1" : null,
      correctCost: correctCost ?? null,
      marginNow: correctCost !== undefined && p.price > 0 ? r2(((p.price - correctCost) / p.price) * 100) : null,
      found: !!nv,
      baseDiff: base !== undefined ? r2(ourBase - base) : null,
    };
  });
  if (req.nextUrl.searchParams.has("csv")) {
    const cols = Object.keys(rows[0] ?? {});
    const esc = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(","))].join("\n");
    return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="neovitale-price-audit.csv"' } });
  }
  type Agg = { n: number; found: number; onSale: number; pct: number | string | null; costLow: number; belowCost: number; baseOff: number; sumMargin: number; mN: number };
  const by = new Map<string, Agg>();
  for (const r of rows) {
    const a = by.get(r.brand) ?? { n: 0, found: 0, onSale: 0, pct: r.discountPct, costLow: 0, belowCost: 0, baseOff: 0, sumMargin: 0, mN: 0 };
    a.n++; if (r.found) a.found++; if (r.nvOnSale) a.onSale++;
    if (r.correctCost !== null && (r.ourCost === null || r.ourCost < r.correctCost - 0.01)) a.costLow++;
    if (r.correctCost !== null && r.ourPrice < r.correctCost) a.belowCost++;
    if (r.baseDiff !== null && Math.abs(r.baseDiff) > 0.01) a.baseOff++;
    if (r.marginNow !== null) { a.sumMargin += r.marginNow; a.mN++; }
    by.set(r.brand, a);
  }
  const brands = [...by].map(([brand, a]) => ({ brand, products: a.n, foundOnNV: a.found, onSaleAtNV: a.onSale, sheetDiscount: a.pct, costUnderstated: a.costLow, sellingBelowCost: a.belowCost, ourBaseDiffers: a.baseOff, avgMarginNow: a.mN ? r2(a.sumMargin / a.mN) : null })).sort((x, y) => y.products - x.products);
  const tot = (k: keyof (typeof brands)[number]) => brands.reduce((s, b) => s + (typeof b[k] === "number" ? (b[k] as number) : 0), 0);
  const worst = rows.filter((r) => r.correctCost !== null && r.ourPrice < r.correctCost).sort((a, b) => (a.marginNow ?? 0) - (b.marginNow ?? 0)).slice(0, 25);
  const baseOff = rows.filter((r) => r.baseDiff !== null && Math.abs(r.baseDiff) > 0.01).sort((a, b) => Math.abs(b.baseDiff ?? 0) - Math.abs(a.baseDiff ?? 0)).slice(0, 25);
  return NextResponse.json({
    checkedAt: new Date().toISOString(), nvVariantsLive: live.size, ourNeoProducts: rows.length,
    totals: { foundOnNV: tot("foundOnNV"), onSaleAtNV: tot("onSaleAtNV"), costUnderstated: tot("costUnderstated"), sellingBelowCost: tot("sellingBelowCost"), ourBaseDiffers: tot("ourBaseDiffers"), noSheetDiscount: rows.filter((r) => r.discountPct === null).length },
    brands, worst, baseOff,
  });
}
