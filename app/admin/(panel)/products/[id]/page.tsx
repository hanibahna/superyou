import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { getProductDetail, getTaxonomy } from "@/lib/catalog";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const [product, taxonomy] = await Promise.all([getProductDetail((await params).id), getTaxonomy()]);
  if (!product) notFound();
  return <ProductForm taxonomy={taxonomy} product={product} />;
}
