import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getIndex, getTaxonomy } from "@/lib/catalog";
import { searchProducts } from "@/lib/search";

// Product finder for admin pickers (gifts, pinned results, homepage rows, videos).
export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const skus = req.nextUrl.searchParams.get("skus");
  const slugs = req.nextUrl.searchParams.get("slugs");
  const [idx, tax] = await Promise.all([getIndex(), getTaxonomy()]);
  let list = idx.all;
  if (skus) {
    const want = new Set(skus.split(",").map((s) => s.trim().toLowerCase()));
    list = list.filter((p) => want.has(p.sku.toLowerCase()));
  } else if (slugs) {
    const want = new Set(slugs.split(","));
    list = list.filter((p) => want.has(p.slug)).filter((p, i, a) => a.findIndex((x) => x.slug === p.slug) === i);
  } else if (q) list = searchProducts(list, q, tax).slice(0, 20);
  else list = [];
  return NextResponse.json(list.slice(0, 200).map((p) => ({ sku: p.sku, slug: p.slug, name: p.name, brand: p.brand, variant: p.variant, price: p.price, image: p.image, inStock: p.inStock })));
}
