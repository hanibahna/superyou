import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getIndex, getTaxonomy } from "@/lib/catalog";
import { searchProducts } from "@/lib/search";

// Product search for the visibility page (includes drafts, with status and id).
export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json([]);
  const [idx, tax] = await Promise.all([getIndex(), getTaxonomy()]);
  const bySku = idx.all.filter((p) => p.sku.toLowerCase() === q.toLowerCase());
  const hits = bySku.length ? bySku : searchProducts(idx.all, q, tax).slice(0, 60);
  return NextResponse.json(hits.map((p) => ({ id: p.id, sku: p.sku, slug: p.slug, name: p.name, brand: p.brand, variant: p.variant, price: p.price, image: p.image, inStock: p.inStock, status: p.status })));
}
