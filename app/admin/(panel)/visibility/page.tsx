import { VisibilityEditor } from "@/components/admin/VisibilityEditor";
import { getAllProducts, getIndex, getTaxonomy } from "@/lib/catalog";
import { getVisibility } from "@/lib/site-store";

export default async function VisibilityPage() {
  const [all, vis, tax, idx] = await Promise.all([getAllProducts(), getVisibility(), getTaxonomy(), getIndex()]);
  const catCount = new Map<string, Set<string>>();
  for (const p of idx.all) if (p.status === "active") (catCount.get(p.category) ?? catCount.set(p.category, new Set()).get(p.category)!).add(p.slug);
  const sources = new Map<string, { items: Set<string>; active: number }>();
  const brands = new Map<string, { items: Set<string>; sources: Set<string> }>();
  for (const p of all) {
    const src = p.source || "manual";
    const s = sources.get(src) ?? sources.set(src, { items: new Set(), active: 0 }).get(src)!;
    s.items.add(p.slug);
    if (p.status === "active") s.active++;
    const b = brands.get(p.brand) ?? brands.set(p.brand, { items: new Set(), sources: new Set() }).get(p.brand)!;
    b.items.add(p.slug);
    b.sources.add(src);
  }
  return (
    <VisibilityEditor
      initial={vis}
      categories={tax.categories.map((c) => ({ slug: c.slug, name: c.name, items: catCount.get(c.slug)?.size ?? 0 }))}
      sources={[...sources.entries()].map(([name, v]) => ({ name, items: v.items.size, active: v.active })).sort((a, b) => b.items - a.items)}
      brands={[...brands.entries()].map(([name, v]) => ({ name, items: v.items.size, sources: [...v.sources] })).sort((a, b) => a.name.localeCompare(b.name))}
    />
  );
}
