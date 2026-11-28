import { PromotionsEditor } from "@/components/admin/PromotionsEditor";
import { getAllProducts, getTaxonomy } from "@/lib/catalog";
import { getPromotions } from "@/lib/site-store";
import { PricingTabs } from "@/components/admin/PricingTabs";
import { roomByBrand } from "@/lib/pricing-room";

export default async function PromotionsPage() {
  const [promos, tax, all, room] = await Promise.all([getPromotions(), getTaxonomy(), getAllProducts(), roomByBrand()]);
  const brands = Array.from(new Set(all.map((p) => p.brand))).sort((a, b) => a.localeCompare(b));
  return <div><PricingTabs /><PromotionsEditor initial={promos} taxonomy={tax} brands={brands} room={room} /></div>;
}
