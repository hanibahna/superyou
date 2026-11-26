import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { fullName } from "@/lib/data/catalog";
import { limited } from "@/lib/ratelimit";
import { getIndex } from "@/lib/catalog";
import { addReview, getGrowth, orderIdsByPhone } from "@/lib/growth-store";
import { getOrder } from "@/lib/orders";

// Native app: write a review. Signed-in shoppers (phone + one of their order numbers) who bought it are "verified buyers".
export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "reviews", 20);
  if (tooMany) return tooMany;
  const p = z.object({
    slug: z.string().min(1).max(200), rating: z.number().int().min(1).max(5), title: z.string().max(100).default(""), body: z.string().min(3).max(2000),
    name: z.string().min(1).max(60), skinType: z.string().max(30).optional(), phone: z.string().max(30).optional(), order: z.string().max(40).optional(),
  }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Please add a star rating, your name and a few words" }, { status: 400 });
  const g = await getGrowth();
  if (!g.reviews.enabled) return NextResponse.json({ error: "Reviews are closed" }, { status: 400 });
  const d = p.data;
  const idx = await getIndex();
  const product = idx.all.find((x) => x.slug === d.slug);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  let verified = false;
  let orderId: string | undefined;
  if (d.phone && d.order) {
    const ids = await orderIdsByPhone(d.phone);
    if (ids.includes(d.order.trim().toUpperCase())) {
      for (const id of ids.slice(0, 20)) {
        const o = await getOrder(id);
        if (o && o.status === "delivered" && o.lines.some((l) => idx.byId.get(l.productId)?.slug === d.slug)) { verified = true; orderId = id; break; }
      }
    }
  }
  const r = await addReview({ slug: d.slug, product: fullName(product.brand, product.name), rating: d.rating, title: d.title, body: d.body, name: d.name, skinType: d.skinType, verified, orderId }, g.reviews.autoApprove);
  return NextResponse.json({ ok: true, status: r.status, verified });
}
