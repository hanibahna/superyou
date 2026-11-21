import { getT } from "@/lib/i18n-server";
import Link from "next/link";
import { ProductImage } from "@/components/ProductImage";
import { ReviewForm } from "@/components/Reviews";
import { getIndex } from "@/lib/catalog";
import { getOrder } from "@/lib/orders";

export const metadata = { title: "Rate your order" };

// Opened from the WhatsApp review request: rate each item of a delivered order (verified reviews).
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ o?: string; t?: string }> }) {
  const tx = await getT();
  const { o = "", t = "" } = await searchParams;
  const order = o ? await getOrder(o) : null;
  if (!order || order.accessToken !== t) return <div className="container-x py-24 text-center"><p className="text-muted">This review link isn't valid. <Link href="/" className="underline">Go to the shop</Link></p></div>;
  const idx = await getIndex();
  const items = order.lines.filter((l) => !l.gift).map((l) => idx.byId.get(l.productId)).filter((p): p is NonNullable<typeof p> => !!p);
  const unique = [...new Map(items.map((p) => [p.slug, p])).values()];
  return (
    <div className="container-x max-w-2xl py-12">
      <h1 className="text-3xl font-semibold">How did you like your order, {order.customer.firstName}?</h1>
      <p className="mt-2 text-muted">{tx("Your reviews help other customers choose — and our pharmacists read every one.")}</p>
      <div className="mt-8 space-y-6">
        {unique.map((p) => (
          <div key={p.slug} className="grid gap-4 rounded-2xl border border-line p-5 sm:grid-cols-[96px_1fr]">
            <ProductImage product={p} width={200} className="aspect-square w-24 rounded-lg" />
            <ReviewForm inline slug={p.slug} product={`${p.brand} ${p.name}`} orderId={order.id} token={t} />
          </div>
        ))}
      </div>
    </div>
  );
}
