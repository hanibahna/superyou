import { Importer } from "@/components/admin/Importer";
import { PhotoMatcher } from "@/components/admin/PhotoMatcher";
import { StoreImporter } from "@/components/admin/StoreImporter";
import { getAllProducts } from "@/lib/catalog";

export default async function ImportPage() {
  const products = await getAllProducts();
  return (
    <div className="space-y-8">
      <StoreImporter />
      <PhotoMatcher />
      <Importer existing={products.map((p) => ({ id: p.id, sku: p.sku }))} />
    </div>
  );
}
