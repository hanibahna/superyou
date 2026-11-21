import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getIndex } from "@/lib/catalog";
import { addReview, getGrowth, productReviews } from "@/lib/growth-store";
import { getOrder } from "@/lib/orders";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const list = slug ? await productReviews(slug) : [];
  return NextResponse.json({ reviews: list.slice(0, 100) });
}

const schema = z.object({
  slug: z.string().min(1).max(200), rating: z.number().int().min(1).max(5), title: z.string().max(100).default(""), body: z.string().min(3).max(2000),
  name: z.string().min(1).max(60), skinType: z.string().max(30).optional(), photo: z.string().url().max(500).optional().or(z.literal("")),
  orderId: z.string().max(40).optional(), token: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please add a star rating, your name and a few words" }, { status: 400 });
  const g = await getGrowth();
  if (!g.reviews.enabled) return NextResponse.json({ error: "Reviews are closed" }, { status: 400 });
  const d = parsed.data;
  const idx = await getIndex();
  const product = idx.all.find((p) => p.slug === d.slug);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  // Verified buyer when the link came from their order.
  let verified = false;
  if (d.orderId && d.token) {
    const o = await getOrder(d.orderId);
    verified = !!o && o.accessToken === d.token && o.lines.some((l) => idx.byId.get(l.productId)?.slug === d.slug);
  }
  const r = await addReview({ slug: d.slug, product: `${product.brand} ${product.name}`, rating: d.rating, title: d.title, body: d.body, name: d.name, skinType: d.skinType, photo: d.photo || undefined, verified, orderId: verified ? d.orderId : undefined }, g.reviews.autoApprove);
  return NextResponse.json({ ok: true, status: r.status });
}
