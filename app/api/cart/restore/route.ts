import { NextResponse, type NextRequest } from "next/server";
import { shopImg } from "@/lib/img";
import { cartByToken } from "@/lib/carts";
import { liveProducts } from "@/lib/pricing";

// The link in the "you left something" message: returns the saved bag so the cart page can refill it.
export async function GET(req: NextRequest) {
  const c = await cartByToken(req.nextUrl.searchParams.get("t") ?? "");
  if (!c) return NextResponse.json({ items: [] });
  const live = await liveProducts();
  const items = c.items
    .map((i) => ({ qty: i.qty, p: live.byId.get(i.productId) }))
    .filter((i) => i.p?.inStock)
    .map(({ qty, p }) => ({ qty, product: { id: p!.id, slug: p!.slug, name: p!.name, brand: p!.brand, price: p!.price, compareAt: p!.compareAt, size: p!.size, variant: p!.variant, image: shopImg(p!.image), shape: p!.shape, color: p!.color, inStock: p!.inStock } }));
  return NextResponse.json({ items, code: c.code });
}
