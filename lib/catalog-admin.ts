import "server-only";

import { assignSlugs, getIndex, getProductsDetailed, getTaxonomy, newId, saveProducts, saveTaxonomy } from "@/lib/catalog";
import { slugify, type Concern, type Product } from "@/lib/data/catalog";
import { normaliseProduct, type ProductInput } from "@/lib/product-input";

export type UpsertReport = {
  created: number;
  updated: number;
  errors: { row: number; sku?: string; errors: string[] }[];
  products: Product[];
};

/**
 * Create or update products. Matches existing products by id (from the editor)
 * or by SKU (from imports). New categories/concerns are added automatically.
 */
export async function upsertProducts(inputs: (ProductInput & { _row?: number })[]): Promise<UpsertReport> {
  const [idx, tax] = await Promise.all([getIndex(), getTaxonomy()]);
  const report: UpsertReport = { created: 0, updated: 0, errors: [], products: [] };

  // Full records of the products these rows will update (needed to keep fields a row leaves blank).
  const matchIds = new Set<string>();
  for (const i of inputs) {
    const id = (i.id && idx.byId.has(i.id) && i.id) || idx.skuToId.get(String(i.sku ?? "").trim().toLowerCase());
    if (id) matchIds.add(id);
  }
  const existingFull = new Map((await getProductsDetailed([...matchIds])).map((p) => [p.id, p]));

  const seenSku = new Map<string, number>();
  const ready: Product[] = [];
  let taxChanged = false;

  inputs.forEach((input, i) => {
    const row = input._row ?? i + 1;
    const skuKey = String(input.sku ?? "").trim().toLowerCase();
    if (skuKey && seenSku.has(skuKey)) {
      report.errors.push({ row, sku: input.sku, errors: [`duplicate SKU (also on row ${seenSku.get(skuKey)})`] });
      return;
    }
    if (skuKey) seenSku.set(skuKey, row);

    const clashId = idx.skuToId.get(skuKey);
    if (input.id && clashId && clashId !== input.id) {
      report.errors.push({ row, sku: input.sku, errors: ["another product already uses this SKU"] });
      return;
    }
    const existingId = (input.id && idx.byId.has(input.id) && input.id) || clashId;
    const existing = existingId ? existingFull.get(existingId) : undefined;

    const r = normaliseProduct(input, tax, existing);
    if (!r.ok) {
      report.errors.push({ row, sku: input.sku, errors: r.errors });
      return;
    }
    for (const name of r.newCategories) {
      const slug = slugify(name);
      if (slug && !tax.categories.some((c) => c.slug === slug)) {
        tax.categories.push({ slug, name: name.trim() });
        taxChanged = true;
      }
    }
    for (const name of r.newConcerns) {
      const slug = slugify(name);
      if (slug && !tax.concerns.some((c) => c.slug === slug)) {
        const group: Concern["group"] = r.product.category === "hair" ? "hair" : r.product.category === "supplements" ? "wellness" : "skin";
        tax.concerns.push({ slug, name: name.trim(), group });
        taxChanged = true;
      }
    }
    const p = { ...r.product, id: existing?.id ?? newId() };
    existing ? report.updated++ : report.created++;
    ready.push(p);
  });

  const withSlugs = assignSlugs(ready, idx.bySlug);
  await saveProducts(withSlugs);
  if (taxChanged) await saveTaxonomy(tax);
  report.products = withSlugs;
  return report;
}
