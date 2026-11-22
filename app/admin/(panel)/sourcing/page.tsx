import { SourcingEditor } from "@/components/admin/SourcingEditor";
import { getAllProducts } from "@/lib/catalog";
import { getSourcing } from "@/lib/site-store";

export default async function SourcingPage() {
  const [all, sourcing] = await Promise.all([getAllProducts(), getSourcing()]);
  const stats = new Map<string, { items: Set<string>; inStock: number }>();
  for (const p of all) {
    const src = p.source || "manual";
    const s = stats.get(src) ?? stats.set(src, { items: new Set(), inStock: 0 }).get(src)!;
    s.items.add(p.slug);
    if (p.inStock) s.inStock++;
  }
  return <SourcingEditor initial={sourcing} stats={[...stats.entries()].map(([name, v]) => ({ name, items: v.items.size, inStock: v.inStock }))} />;
}
