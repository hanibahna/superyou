import { ProductsTable } from "@/components/admin/ProductsTable";
import { CleanSlugs } from "@/components/admin/CleanSlugs";
import { getAllProducts, getTaxonomy } from "@/lib/catalog";

const PER = 50;
type SP = Record<string, string | undefined>;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [all, tax] = await Promise.all([getAllProducts(), getTaxonomy()]);
  const q = (sp.q ?? "").trim().toLowerCase();
  const filter = sp.filter ?? "all";
  const cat = sp.cat ?? "";
  const brand = sp.brand ?? "";
  const rows = all.filter(
    (p) =>
      (!q || `${p.name} ${p.brand} ${p.sku} ${p.barcode ?? ""} ${p.variant ?? ""}`.toLowerCase().includes(q)) &&
      (!cat || p.category === cat) &&
      (!brand || p.brand === brand) &&
      (filter === "all" || (filter === "active" && p.status === "active") || (filter === "draft" && p.status === "draft") || (filter === "soldout" && !p.inStock) || (filter === "noimage" && !p.image)),
  );
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const page = Math.min(Math.max(1, Number(sp.page ?? 1) || 1), pages);
  const dirty = new Set(all.filter((p) => /-sks-\d+$/.test(p.slug)).map((p) => p.slug)).size;
  return (
    <>
    <CleanSlugs count={dirty} />
    <ProductsTable
      rows={rows.slice((page - 1) * PER, page * PER)}
      matching={rows.length}
      total={all.length}
      page={page}
      pages={pages}
      categories={tax.categories}
      query={{ q: sp.q ?? "", filter, cat, brand }}
    />
    </>
  );
}
