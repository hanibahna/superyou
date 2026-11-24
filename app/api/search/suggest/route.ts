import { NextResponse, type NextRequest } from "next/server";
import { getTaxonomy } from "@/lib/catalog";
import { toCards } from "@/lib/listing";
import { liveProducts } from "@/lib/pricing";
import { norm, redirectFor, searchProducts } from "@/lib/search";
import { getSearchSettings } from "@/lib/site-store";

// Suggestions while typing: top products plus matching brands, categories and concerns.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 80).trim();
  if (q.length < 2) return NextResponse.json({ products: [], brands: [], categories: [], concerns: [] });
  const [live, tax, ss] = await Promise.all([liveProducts(), getTaxonomy(), getSearchSettings()]);
  let hits = searchProducts(live.list, q, tax, ss);
  if (ss.outOfStock !== "show") hits = [...hits.filter((p) => p.inStock), ...(ss.outOfStock === "last" ? hits.filter((p) => !p.inStock) : [])];
  const products = toCards(hits.slice(0, 60)).slice(0, 6).map((c) => ({ slug: c.slug, name: c.name, brand: c.brand, price: c.matchWas || c.price, image: c.image }));
  const nq = norm(q);
  const brands = Array.from(new Set(live.list.map((p) => p.brand))).filter((b) => norm(b).includes(nq)).sort((a, b) => Number(norm(b).startsWith(nq)) - Number(norm(a).startsWith(nq))).slice(0, 5);
  const categories = tax.categories.filter((c) => norm(c.name).includes(nq)).slice(0, 4).map((c) => ({ slug: c.slug, name: c.name }));
  const concerns = tax.concerns.filter((c) => norm(c.name).includes(nq)).slice(0, 4).map((c) => ({ slug: c.slug, name: c.name }));
  return NextResponse.json({ products, brands, categories, concerns, redirect: redirectFor(q, ss) }, { headers: { "Cache-Control": "public, max-age=30" } });
}
