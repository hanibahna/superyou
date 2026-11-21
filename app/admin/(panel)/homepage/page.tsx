import { HomepageEditor } from "@/components/admin/HomepageEditor";
import { getAllProducts, getTaxonomy } from "@/lib/catalog";
import { getLanding } from "@/lib/site-store";

export default async function HomepagePage() {
  const [landing, tax, all] = await Promise.all([getLanding(), getTaxonomy(), getAllProducts()]);
  const brands = Array.from(new Set(all.map((p) => p.brand))).sort((a, b) => a.localeCompare(b));
  return <HomepageEditor initial={landing} taxonomy={tax} brands={brands} />;
}
