import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { liveProducts } from "@/lib/pricing";
import { pressReviews } from "@/lib/press-reviews";

// Admin: re-search one product's expert reviews and show why (refreshes its cache).
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const p = (await liveProducts()).list.find((x) => x.slug === slug);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const trace: string[] = [];
  const reviews = await pressReviews({ slug, brand: p.brand, name: p.name }, trace);
  return NextResponse.json({ reviews, trace });
}
