import { PromotionsEditor } from "@/components/admin/PromotionsEditor";
import { getAllProducts, getTaxonomy } from "@/lib/catalog";
import { getPromotions } from "@/lib/site-store";

export default async function PromotionsPage() {
  const [promos, tax, all] = await Promise.all([getPromotions(), getTaxonomy(), getAllProducts()]);
  const brands = Array.from(new Set(all.map((p) => p.brand))).sort((a, b) => a.localeCompare(b));
  return <PromotionsEditor initial={promos} taxonomy={tax} brands={brands} />;
}
