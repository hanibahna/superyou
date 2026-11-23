import { NextResponse, type NextRequest } from "next/server";
import { liveProducts } from "@/lib/pricing";
import { getGuide, makeGuide } from "@/lib/product-guide";

export const maxDuration = 90;

// The stored AI "How to use" guide for a product; written once on first view if missing.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const p = (await liveProducts()).list.find((x) => x.slug === slug);
  if (!p) return NextResponse.json({ guide: null });
  let guide = await getGuide(slug);
  if (!guide) {
    const { getProductDetail, } = await import("@/lib/catalog");
    const { hasGuide } = await import("@/lib/product-guide");
    if (!(await hasGuide(slug))) {
      const d = await getProductDetail(p.id);
      if (d) guide = await makeGuide(slug, { brand: d.brand, name: d.name, category: d.category, description: d.description, howToUse: d.howToUse, ingredients: d.ingredients });
    }
  }
  return NextResponse.json({ guide }, { headers: { "Cache-Control": guide ? "public, s-maxage=86400" : "no-store" } });
}
