import { NextResponse, type NextRequest } from "next/server";
import { liveProducts } from "@/lib/pricing";
import { getProductTips, makeProductTips } from "@/lib/product-tips-ai";

// Tips for one product page; written once on first view, then stored.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const p = (await liveProducts()).list.find((x) => x.slug === slug);
  if (!p) return NextResponse.json({ tips: [] });
  let tips = await getProductTips(slug);
  if (!tips) {
    const d = await (await import("@/lib/catalog")).getProductDetail(p.id);
    tips = d ? await makeProductTips(slug, { brand: d.brand, name: d.name, category: d.category, description: d.description, howToUse: d.howToUse, ingredients: d.ingredients }) : [];
  }
  return NextResponse.json({ tips }, { headers: { "Cache-Control": tips.length ? "public, s-maxage=86400" : "no-store" } });
}
