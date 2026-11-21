import { ProductForm } from "@/components/admin/ProductForm";
import { getTaxonomy } from "@/lib/catalog";

export default async function NewProduct() {
  return <ProductForm taxonomy={await getTaxonomy()} />;
}
