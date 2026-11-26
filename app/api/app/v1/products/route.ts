import { NextResponse, type NextRequest } from "next/server";
import { queryShop } from "@/lib/listing";
import { parseQuery } from "@/lib/shop-query";
import { siteUrl } from "@/lib/site-url";

// Native app: search and browse (same filters as /shop: q, category, collection, brand, concern, origin, sale, sort, page).
export async function GET(req: NextRequest) {
  const sp = Object.fromEntries([...req.nextUrl.searchParams.keys()].map((k) => [k, req.nextUrl.searchParams.getAll(k)]));
  const q = parseQuery(sp);
  const r = await queryShop({ ...q, perPage: 24 });
  const abs = (u?: string) => (!u ? "" : u.startsWith("http") ? u : `${siteUrl()}${u}`);
  // Filters for the app's filter sheet (first page only, so scrolling stays light).
  const facets = r.page === 1 ? { brands: r.facets.brands.slice(0, 60), concerns: r.facets.concerns.map((c) => ({ slug: c.slug, name: c.name, count: c.count })), categories: r.facets.categories.map((c) => ({ slug: c.slug, name: c.name, count: c.count })), price: r.priceRange } : null;
  return NextResponse.json({ items: r.items.map((p) => ({ ...p, image: abs(p.image) })), total: r.total, page: r.page, pages: r.pages, facets });
}
