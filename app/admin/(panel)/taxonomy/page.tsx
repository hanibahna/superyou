import { TaxonomyEditor } from "@/components/admin/TaxonomyEditor";
import { getAllProducts, getTaxonomy } from "@/lib/catalog";

export default async function TaxonomyPage() {
  const [taxonomy, products] = await Promise.all([getTaxonomy(), getAllProducts()]);
  const counts: Record<string, number> = {};
  for (const p of products) {
    counts[`c:${p.category}`] = (counts[`c:${p.category}`] ?? 0) + 1;
    for (const k of p.concerns) counts[`k:${k}`] = (counts[`k:${k}`] ?? 0) + 1;
  }
  return <TaxonomyEditor initial={taxonomy} counts={counts} />;
}
