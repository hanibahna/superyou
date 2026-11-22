import { NextResponse, type NextRequest } from "next/server";
import { liveProducts } from "@/lib/pricing";
import { videosForProduct } from "@/lib/youtube";

// YouTube videos for one product page (loaded after the page, so it never slows it down).
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const p = (await liveProducts()).list.find((x) => x.slug === slug);
  if (!p) return NextResponse.json({ videos: [] });
  const videos = await videosForProduct({ slug, brand: p.brand, name: p.name });
  return NextResponse.json({ videos }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
