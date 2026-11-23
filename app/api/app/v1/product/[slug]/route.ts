import { NextResponse, type NextRequest } from "next/server";
import { getGroupBySlug, getProductDetail } from "@/lib/catalog";
import { shopImg } from "@/lib/img-server";
import { liveProducts } from "@/lib/pricing";
import { siteUrl } from "@/lib/site-url";
import { productTips } from "@/lib/tips";
import { isSubscribable } from "@/lib/subscribable";
import { genderOf } from "@/lib/gender";

// Native app: one product with its variants, pictures, description and delivery info. No supplier data.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const [raw, live] = await Promise.all([getGroupBySlug(slug), liveProducts()]);
  const variants = raw.map((v) => live.byId.get(v.id)).filter((v): v is NonNullable<typeof v> => !!v);
  if (!variants.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const first = variants.find((v) => v.inStock) ?? variants[0];
  const d = await getProductDetail(first.id);
  const abs = (u?: string) => (!u ? "" : u.startsWith("http") ? u : `${siteUrl()}${u}`);
  const images = Array.from(new Set([...(d?.images ?? []).map((x) => abs(shopImg(x))), ...variants.map((v) => abs(shopImg(v.image)))].filter(Boolean)));
  return NextResponse.json({
    slug, name: first.name, brand: first.brand, images,
    description: d?.description ?? "", howToUse: d?.howToUse ?? "", ingredients: d?.ingredients ?? "",
    rating: first.rating ?? null, reviewCount: first.reviewCount ?? 0,
    category: first.category ?? "",
    tips: productTips({ name: first.name, category: first.category ?? "", concerns: first.concerns ?? [] }).slice(0, 3),
    guide: await (await import("@/lib/product-guide")).getGuide(slug),
    ...(await (async () => { const l = await (await import("@/lib/lifespan")).getLife(slug); return { subscribable: l ? l.every > 0 : isSubscribable({ name: first.name, category: first.category ?? "" }), life: l && l.every ? { days: l.days, every: l.every, basis: l.basis } : null }; })()),
    url: `${siteUrl()}/products/${slug}/`,
    variants: variants.map((v) => ({ id: v.id, name: v.variant || v.size || v.name, price: v.price, compareAt: v.compareAt ?? null, inStock: v.inStock, image: abs(shopImg(v.image)), origin: v.origin ?? "local", shipFrom: v.shipFrom ?? "Lebanon", daysMin: v.daysMin ?? 1, daysMax: v.daysMax ?? 3 })),
  });
}
