import { CollectionsEditor } from "@/components/admin/CollectionsEditor";
import { getAllProducts } from "@/lib/catalog";
import { getCollections } from "@/lib/site-store";

export default async function CollectionsPage() {
  const [cols, all] = await Promise.all([getCollections(), getAllProducts()]);
  const counts: Record<string, number> = {};
  for (const p of all) for (const k of p.collections ?? []) counts[k.toLowerCase()] = (counts[k.toLowerCase()] ?? 0) + 1;
  return <CollectionsEditor initial={cols} counts={counts} />;
}
