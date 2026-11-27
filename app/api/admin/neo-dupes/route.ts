import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { brandKey, getIndex, getProductsDetailed, saveProducts } from "@/lib/catalog";
import { db } from "@/lib/db-core";
import type { ProductLite } from "@/lib/data/catalog";

export const maxDuration = 300;

// NeoVitale items that are duplicates of another item in our catalog (same barcode, or same brand +
// name + size) where the other copy has a lower base price. The NeoVitale copy is hidden (set to
// draft, not deleted) so the 3-day sync doesn't add it back; ids are kept in "neo:dupes" so the sync
// leaves them alone. GET = preview (?list=1 for every pair), GET ?apply=1 = hide.
// Only hidden when the cheaper copy is live and in stock, or the NeoVitale copy is sold out anyway.
const NEO = "neovitale.com";
const r2 = (n: number) => Math.round(n * 100) / 100;
const base = (p: ProductLite) => r2(p.compareAt && p.compareAt > p.price ? p.compareAt : p.price);
const digits = (s?: string) => (s ?? "").replace(/\D/g, "").replace(/^0+/, "");
const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[®™©]/g, "");
const sizeKey = (s: string) => (words(s).match(/\d+(?:[.,]\d+)?\s*(?:ml|g|gr|mg|l|oz|pcs?|caps?|tabs?|x)\b/g) ?? []).map((m) => m.replace(/[\s,]/g, (c) => (c === "," ? "." : "")).replace(/gr$/, "g")).sort().join("+");
function nameKey(p: ProductLite) {
  const b = brandKey(p.brand);
  const text = words(`${p.name} ${p.variant ?? ""} ${p.size ?? ""}`);
  const size = sizeKey(text);
  const n = text.replace(/\d+(?:[.,]\d+)?\s*(?:ml|g|gr|mg|l|oz|pcs?|caps?|tabs?|x)\b/g, " ").replace(/[^a-z0-9]+/g, "");
  const nb = b && n.startsWith(b) ? n.slice(b.length) : n;
  return nb.length >= 6 ? `${b}|${nb}|${size}` : "";
}
const label = (p: ProductLite) => `${p.brand} | ${p.name}${p.variant ? ` · ${p.variant}` : ""}`;
const live = (p: ProductLite) => p.status === "active" && p.inStock && p.price > 0;

export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const apply = req.nextUrl.searchParams.has("apply");
  const list = req.nextUrl.searchParams.has("list");
  const idx = await getIndex();
  const candidates = idx.all.filter((p) => p.status === "active" && p.price > 0);
  const byBarcode = new Map<string, ProductLite[]>();
  const byName = new Map<string, ProductLite[]>();
  for (const p of candidates) {
    const bc = digits(p.barcode);
    if (bc.length >= 8) byBarcode.set(bc, [...(byBarcode.get(bc) ?? []), p]);
    const k = nameKey(p);
    if (k) byName.set(k, [...(byName.get(k) ?? []), p]);
  }
  const hide = new Map<string, { neo: ProductLite; other: ProductLite; how: string }>();
  const keptBecauseOtherNotLive: string[] = [];
  const consider = (group: ProductLite[], how: string) => {
    if (group.length < 2 || !group.some((p) => p.source === NEO)) return;
    for (const neo of group.filter((p) => p.source === NEO)) {
      const cheaper = group.filter((o) => o.id !== neo.id && base(o) < base(neo) - 0.005 && !hide.has(o.id)).sort((a, b) => Number(live(b)) - Number(live(a)) || base(a) - base(b))[0];
      if (!cheaper || hide.has(neo.id)) continue;
      if (live(cheaper) || !neo.inStock) hide.set(neo.id, { neo, other: cheaper, how });
      else keptBecauseOtherNotLive.push(`${label(neo)} $${base(neo)} — cheaper copy is sold out: ${label(cheaper)} $${base(cheaper)}`);
    }
  };
  for (const g of byBarcode.values()) consider(g, "barcode");
  for (const g of byName.values()) consider(g, "name+size");
  const rows = [...hide.values()].map(({ neo, other, how }) => `${label(neo)} $${base(neo)}  →  kept: ${other.source === NEO ? "another NeoVitale copy" : (other.source ?? "own")} ${label(other)} $${base(other)} [${how}]`);
  if (apply && hide.size) {
    const ids = [...hide.keys()];
    for (let i = 0; i < ids.length; i += 400) {
      const part = await getProductsDetailed(ids.slice(i, i + 400));
      await saveProducts(part.map((p) => ({ ...p, status: "draft" as const })));
    }
    for (let i = 0; i < ids.length; i += 500) await db.cmd(["SADD", "neo:dupes", ...ids.slice(i, i + 500)]);
  }
  const vs = (s?: string) => (s === NEO ? "neovitale" : "other source");
  const pairs = [...hide.values()];
  return NextResponse.json({
    applied: apply,
    neovitaleActive: candidates.filter((p) => p.source === NEO).length,
    toHide: hide.size,
    byBarcode: pairs.filter((x) => x.how === "barcode").length,
    byNameAndSize: pairs.filter((x) => x.how !== "barcode").length,
    cheaperCopyIs: { neovitale: pairs.filter((x) => vs(x.other.source) === "neovitale").length, otherSource: pairs.filter((x) => vs(x.other.source) !== "neovitale").length },
    keptBecauseCheaperCopySoldOut: keptBecauseOtherNotLive.length,
    sample: list ? rows : rows.slice(0, 25),
    keptSample: keptBecauseOtherNotLive.slice(0, list ? 500 : 10),
  });
}
