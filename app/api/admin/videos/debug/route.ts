export const maxDuration = 300;
import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { liveProducts } from "@/lib/pricing";
import { videosForProduct } from "@/lib/youtube";

// Admin: shows why a product got (or didn't get) YouTube videos, and refreshes its videos.
export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  // ?brand=X: re-search that brand's products that have no videos yet (each costs ~300 quota units).
  const brand = (req.nextUrl.searchParams.get("brand") ?? "").toLowerCase();
  if (brand) {
    const { cachedVideos } = await import("@/lib/youtube");
    const max = Number(req.nextUrl.searchParams.get("max") ?? 25);
    const list = (await liveProducts()).list.filter((x) => x.brand.toLowerCase() === brand && x.status !== "draft");
    const res: Record<string, number> = {};
    let ran = 0;
    for (const x of list) {
      if ((await cachedVideos(x.slug)).length) { res[x.slug] = -1; continue; }
      if (ran >= max) continue;
      ran++;
      res[x.slug] = (await videosForProduct({ slug: x.slug, brand: x.brand, name: x.name }, [])).length;
    }
    return NextResponse.json({ products: list.length, searched: ran, res });
  }
  const p = (await liveProducts()).list.find((x) => x.slug === slug);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const trace: string[] = [];
  const videos = await videosForProduct({ slug, brand: p.brand, name: p.name }, trace);
  return NextResponse.json({ videos, trace });
}
