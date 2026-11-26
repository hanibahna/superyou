import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getIndex } from "@/lib/catalog";
import { discountFor } from "@/lib/costs/neovitale";
import { fetchSourcePage } from "@/lib/import/shopify-source";
import { db } from "@/lib/db-core";

export const maxDuration = 300;

// Read-only audit of the NeoVitale catalog: our prices and costs against NeoVitale's live site.
// NeoVitale's advertised base price = its "was" price when on sale, otherwise its price.
// Correct cost = that base × (1 − the brand's discount on NeoVitale's sheet). Nothing is changed.
// GET → summary by brand; GET ?csv=1 → one row per product.
type Live = Map<string, { price: number; compare: number; available: boolean }>;
const KEY = "neo-audit:live";
const HKEY = "neo-audit:handles";
const VKEY = "neo-audit:verified";

// One product at a time: open each NeoVitale product's own page data (/products/<handle>.js),
// read the price shown and the crossed-out "was" price per variant, and keep them.
// Called in slices (?verify=0, ?verify=400, …) so each call stays within the time limit.
async function verifySlice(from: number, size: number) {
  const hs = JSON.parse((await db.cmd<string | null>(["GET", HKEY])) ?? "[]") as string[];
  const slice = hs.slice(from, from + size);
  const got: Record<string, [number, number, number]> = {};
  let failed = 0;
  let i = 0;
  const t0 = Date.now();
  const worker = async () => {
    while (i < slice.length) {
      const h = slice[i++];
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const r = await fetch(`https://neovitale.com/products/${encodeURIComponent(h)}.js`, { headers: { "User-Agent": "SuperYou-Catalog-Import/1.0", Accept: "application/json" }, cache: "no-store" });
          if (r.status === 404) break;
          if (r.status === 429) { await new Promise((res) => setTimeout(res, 1000 * (Number(r.headers.get("retry-after")) || 6))); attempt--; if (Date.now() - t0 > 240000) { failed++; break; } continue; }
          if (!r.ok) throw new Error(String(r.status));
          const j = (await r.json()) as { variants: { id: number; price: number; compare_at_price: number | null; available: boolean }[] };
          await new Promise((res) => setTimeout(res, 300));
          for (const v of j.variants) got[String(v.id)] = [v.price / 100, (v.compare_at_price ?? 0) / 100, v.available ? 1 : 0];
          break;
        } catch { if (attempt === 2) failed++; else await new Promise((res) => setTimeout(res, 1500 * (attempt + 1))); }
      }
    }
  };
  await Promise.all([worker(), worker()]);
  const prev = JSON.parse((await db.cmd<string | null>(["GET", VKEY])) ?? "{}") as Record<string, [number, number, number]>;
  Object.assign(prev, got);
  await db.cmd(["SET", VKEY, JSON.stringify(prev), "EX", 172800]);
  return { from, checked: slice.length, variants: Object.keys(got).length, failed, totalHandles: hs.length, verifiedSoFar: Object.keys(prev).length, next: from + size < hs.length ? from + size : null };
}
// NeoVitale's live catalog, kept for 6 hours so repeated reports don't re-crawl their site.
async function liveNeo(fresh: boolean): Promise<Live> {
  if (!fresh) {
    const hit = await db.cmd<string | null>(["GET", KEY]).catch(() => null);
    if (hit) return new Map(Object.entries(JSON.parse(hit) as Record<string, [number, number, number]>).map(([k, [p, c, a]]) => [k, { price: p, compare: c, available: !!a }]));
  }
  const origin = new URL("https://neovitale.com");
  const live: Live = new Map();
  const handles: string[] = [];
  const names: Record<string, string> = {};
  for (let page = 1; page < 200; page++) {
    let list: Awaited<ReturnType<typeof fetchSourcePage>> = [];
    for (let attempt = 0; ; attempt++) {
      try { list = await fetchSourcePage(origin, page); break; } catch (e) { if (attempt >= 3) throw e; await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); }
    }
    if (!list.length) break;
    for (const p of list) { handles.push(p.handle); for (const v of p.variants) names[String(v.id)] = `${p.handle}|${p.vendor}|${p.title}|${v.title === "Default Title" ? "" : v.title}|${p.product_type}`; }
    for (const p of list) for (const v of p.variants) live.set(String(v.id), { price: Number(v.price), compare: v.compare_at_price ? Number(v.compare_at_price) : 0, available: !!v.available });
    await new Promise((r) => setTimeout(r, 250));
  }
  const compact: Record<string, [number, number, number]> = {};
  for (const [k, v] of live) compact[k] = [v.price, v.compare, v.available ? 1 : 0];
  await db.cmd(["SET", KEY, JSON.stringify(compact), "EX", 21600]).catch(() => null);
  await db.cmd(["SET", HKEY, JSON.stringify(handles), "EX", 86400]).catch(() => null);
  await db.cmd(["SET", "neo-audit:names", JSON.stringify(names), "EX", 86400]).catch(() => null);
  return live;
}

export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  // Product data for the given NeoVitale handles, read one product page at a time and shaped like
  // the catalog feed, so Import can add them with { products } (used when the feed is rate-limited).
  const want = req.nextUrl.searchParams.get("fetch");
  if (want) {
    const out: unknown[] = [];
    for (const h of want.split(",").slice(0, 40)) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const r = await fetch(`https://neovitale.com/products/${encodeURIComponent(h)}.js`, { headers: { "User-Agent": "SuperYou-Catalog-Import/1.0", Accept: "application/json" }, cache: "no-store" });
        if (r.status === 404) break;
        if (!r.ok) { await new Promise((res) => setTimeout(res, 1000 * (Number(r.headers.get("retry-after")) || 5))); continue; }
        type JsV = { id: number; title: string; price: number; compare_at_price: number | null; available: boolean; sku: string | null; barcode: string | null; featured_image?: { src: string } | null };
        const j = (await r.json()) as { id: number; title: string; handle: string; vendor: string; type: string; tags: string[]; description: string; images: string[]; options: { name: string; values: string[] }[]; created_at: string; variants: JsV[] };
        const abs = (u: string) => (u.startsWith("//") ? `https:${u}` : u);
        out.push({
          id: j.id, title: j.title, handle: j.handle, vendor: j.vendor, product_type: j.type, tags: j.tags, body_html: j.description, created_at: j.created_at,
          images: j.images.map((src) => ({ src: abs(src) })), options: j.options.map((o) => ({ name: o.name, values: o.values })),
          variants: j.variants.map((v) => ({ id: v.id, title: v.title, price: (v.price / 100).toFixed(2), compare_at_price: v.compare_at_price ? (v.compare_at_price / 100).toFixed(2) : null, available: v.available, sku: v.sku ?? "", barcode: v.barcode ?? "", featured_image: v.featured_image ? { src: abs(v.featured_image.src) } : null })),
        });
        await new Promise((res) => setTimeout(res, 400));
        break;
      }
    }
    return NextResponse.json({ products: out });
  }
  if (req.nextUrl.searchParams.has("missing")) {
    if (req.nextUrl.searchParams.has("fresh")) await liveNeo(true);
    const names = JSON.parse((await db.cmd<string | null>(["GET", "neo-audit:names"])) ?? "{}") as Record<string, string>;
    const idx0 = await getIndex();
    const ours = new Set(idx0.all.filter((p) => p.source === "neovitale.com").map((p) => (p.sku ?? "").split("-").pop()));
    const missing = Object.entries(names).filter(([vid]) => !ours.has(vid)).map(([vid, t]) => { const [handle, brand, title, variant, type] = t.split("|"); return { vid, handle, brand, title, variant, type }; });
    const byHandle = new Map<string, number>();
    for (const m of missing) byHandle.set(m.handle, (byHandle.get(m.handle) ?? 0) + 1);
    return NextResponse.json({ neoVariants: Object.keys(names).length, ours: ours.size, missingVariants: missing.length, missingProducts: byHandle.size, missing });
  }
  const v = req.nextUrl.searchParams.get("verify");
  if (v !== null) {
    if (v === "reset") { await db.cmd(["DEL", VKEY]); await liveNeo(true); return NextResponse.json({ reset: true }); }
    return NextResponse.json(await verifySlice(Number(v) || 0, Math.min(200, Number(req.nextUrl.searchParams.get("size")) || 60)));
  }
  const live = await liveNeo(req.nextUrl.searchParams.has("fresh"));
  const verified = JSON.parse((await db.cmd<string | null>(["GET", VKEY]).catch(() => null)) ?? "{}") as Record<string, [number, number, number]>;
  let pageChecked = 0;
  for (const [k, [p, c, a]] of Object.entries(verified)) { live.set(k, { price: p, compare: c, available: !!a }); pageChecked++; }
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
      found: !!nv, checkedOnPage: vid in verified,
      baseDiff: base !== undefined ? r2(ourBase - base) : null,
    };
  });
  if (req.nextUrl.searchParams.has("csv")) {
    const only = req.nextUrl.searchParams.get("only");
    const out = only === "issues" ? rows.filter((r) => r.correctCost !== null && (r.ourCost === null || Math.abs(r.ourCost - r.correctCost) > 0.01 || r.ourPrice < r.correctCost)) : rows;
    const cols = Object.keys(rows[0] ?? {});
    const esc = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [cols.join(","), ...out.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(","))].join("\n");
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
    checkedAt: new Date().toISOString(), nvVariantsLive: live.size, variantsCheckedOnProductPage: pageChecked, ourNeoProducts: rows.length,
    totals: { foundOnNV: tot("foundOnNV"), onSaleAtNV: tot("onSaleAtNV"), costUnderstated: tot("costUnderstated"), sellingBelowCost: tot("sellingBelowCost"), ourBaseDiffers: tot("ourBaseDiffers"), noSheetDiscount: rows.filter((r) => r.discountPct === null).length },
    brands, worst, baseOff,
  });
}
