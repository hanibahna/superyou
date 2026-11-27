import "server-only";
import { brandKey, getIndex, getProductsDetailed, saveProducts } from "@/lib/catalog";
import { db } from "@/lib/db-core";
import { getVisibility } from "@/lib/site-store";
import type { ProductLite } from "@/lib/data/catalog";

// NeoVitale items that duplicate another item in our catalog (same barcode, or same brand + name +
// size) where the other copy has a lower base price. The NeoVitale copy is hidden (draft, not
// deleted); ids go in "neo:dupes" so the 3-day sync leaves them alone. Always hidden, even when the
// cheaper copy is sold out (those are listed so they can be restocked). Runs after every sync too.
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


export async function findDupes(apply: boolean) {
  const [idx, vis, prev] = await Promise.all([getIndex(), getVisibility(), db.cmd<string[] | null>(["SMEMBERS", "neo:dupes"]).then((x) => new Set(x ?? [])).catch(() => new Set<string>())]);
  // Only copies customers can actually see count as "the cheaper copy" (a hidden catalog or brand doesn't).
  const hiddenSrc = new Set(vis.hiddenSources.map((x) => x.toLowerCase()));
  const hiddenBrand = new Set(vis.hiddenBrands.map((x) => x.toLowerCase()));
  const visible = (p: ProductLite) => !hiddenSrc.has((p.source || "manual").toLowerCase()) && !hiddenBrand.has(p.brand.toLowerCase());
  // NeoVitale items hidden earlier are re-checked too, so they come back if their cheaper copy is gone or hidden.
  const candidates = idx.all.filter((p) => p.price > 0 && visible(p) && (p.status === "active" || (p.source === NEO && prev.has(p.id))));
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
      // Rule (owner, 27 Nov): the more expensive NeoVitale copy is always hidden, even when the cheaper copy is sold out.
      hide.set(neo.id, { neo, other: cheaper, how });
      if (!live(cheaper) && neo.inStock) keptBecauseOtherNotLive.push(`${label(neo)} $${base(neo)} — cheaper copy is sold out: ${label(cheaper)} $${base(cheaper)}`);
    }
  };
  for (const g of byBarcode.values()) consider(g, "barcode");
  for (const g of byName.values()) consider(g, "name+size");
  const rows = [...hide.values()].map(({ neo, other, how }) => `${label(neo)} $${base(neo)}  →  kept: ${other.source === NEO ? "another NeoVitale copy" : (other.source ?? "own")} ${label(other)} $${base(other)} [${how}]`);
  const restore = [...prev].filter((id) => !hide.has(id) && idx.byId.has(id));
  if (apply) {
    const ids = [...hide.keys()].filter((id) => idx.byId.get(id)?.status !== "draft" || !prev.has(id));
    for (let i = 0; i < ids.length; i += 400) {
      const part = await getProductsDetailed(ids.slice(i, i + 400));
      await saveProducts(part.map((p) => ({ ...p, status: "draft" as const })));
    }
    for (let i = 0; i < ids.length; i += 500) await db.cmd(["SADD", "neo:dupes", ...ids.slice(i, i + 500)]);
    for (let i = 0; i < restore.length; i += 400) {
      const part = await getProductsDetailed(restore.slice(i, i + 400));
      await saveProducts(part.map((p) => ({ ...p, status: "active" as const })));
      await db.cmd(["SREM", "neo:dupes", ...restore.slice(i, i + 400)]);
    }
  }
  const vs = (s?: string) => (s === NEO ? "neovitale" : "other source");
  const pairs = [...hide.values()];
  return { applied: apply, candidates, hide, rows, keptBecauseOtherNotLive, pairs, vs, restored: restore.map((id) => label(idx.byId.get(id)!)) };
}
