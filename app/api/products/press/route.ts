import { NextResponse, type NextRequest } from "next/server";
import { liveProducts } from "@/lib/pricing";
import { pressReviews } from "@/lib/press-reviews";

// Expert reviews for one product page (loaded after the page).
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const p = (await liveProducts()).list.find((x) => x.slug === slug);
  if (!p) return NextResponse.json({ reviews: [] });
  const reviews = await pressReviews({ slug, brand: p.brand, name: p.name });
  return NextResponse.json({ reviews }, { headers: { "Cache-Control": reviews.length ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store" } });
}
