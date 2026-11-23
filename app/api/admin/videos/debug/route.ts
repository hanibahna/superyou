import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { liveProducts } from "@/lib/pricing";
import { videosForProduct } from "@/lib/youtube";

// Admin: shows why a product got (or didn't get) YouTube videos, and refreshes its videos.
export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const p = (await liveProducts()).list.find((x) => x.slug === slug);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const trace: string[] = [];
  const videos = await videosForProduct({ slug, brand: p.brand, name: p.name }, trace);
  return NextResponse.json({ videos, trace });
}
