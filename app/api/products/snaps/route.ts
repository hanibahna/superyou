import { NextResponse, type NextRequest } from "next/server";
import { shopImg } from "@/lib/img-server";
import { liveProducts } from "@/lib/pricing";

// Current snapshots for a list of product ids ("buy again", skin scan routines). Only live, in-stock items.
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 40);
  const live = await liveProducts();
  return NextResponse.json({ items: ids.map((id) => live.byId.get(id)).filter((p) => p && p.inStock).map((p) => ({ id: p!.id, slug: p!.slug, name: p!.name, brand: p!.brand, price: p!.price, compareAt: p!.compareAt, size: p!.size, variant: p!.variant, image: shopImg(p!.image), shape: p!.shape, color: p!.color, inStock: p!.inStock })) });
}
