"use client";

import Link from "next/link";
import { ShipBadge } from "./ShipBadge";
import { discountPct, type AnyProduct } from "@/lib/data/catalog";
import { money } from "@/lib/format";
import { useGrowth, useT } from "@/lib/site-context";
import { useShop, type ProductSnap } from "@/lib/store";
import { Stars } from "./Stars";
import { HeartIcon } from "./Icons";
import { ProductImage } from "./ProductImage";

type Card = (AnyProduct | ProductSnap) & { variantCount?: number; priceMax?: number; rating?: number; reviewCount?: number };

export function ProductCard({ product }: { product: Card }) {
  const tx = useT();
  const { add, toggleWish, isWished } = useShop();
  const pct = discountPct(product);
  const wished = isWished(product.id);
  const multi = (product.variantCount ?? 1) > 1;
  const href = `/products/${product.slug}/`;
  const t = useT();
  const { reviews } = useGrowth();

  return (
    <div className="pcard group relative flex h-full flex-col rounded-xl border border-line bg-white p-3 transition hover:shadow-md">
      <button
        onClick={() => toggleWish(product)}
        aria-label={wished ? tx("Remove from wishlist") : tx("Add to wishlist")}
        className={`absolute end-2 top-2 z-10 rounded-full bg-white/90 p-2.5 ${wished ? "text-sale" : "text-muted hover:text-ink"}`}
      >
        <HeartIcon filled={wished} width={18} height={18} />
      </button>
      {pct && <span dir="ltr" className="absolute start-3 top-3 z-10 rounded-md bg-sale px-2 py-0.5 text-xs font-bold text-white">-{pct}%</span>}
      <Link href={href} className="block overflow-hidden rounded-lg">
        <ProductImage product={product} width={480} className="pimg aspect-square w-full transition duration-300 group-hover:scale-105" />
      </Link>
      <div className="mt-3 flex flex-1 flex-col">
        <p className="pbrand truncate text-xs font-semibold uppercase tracking-wide text-muted">{product.brand}</p>
        <Link href={href} className="pname mt-0.5 line-clamp-2 text-sm font-medium leading-snug hover:text-brand-600">
          {product.name}
        </Link>
        {reviews.showOnCards && !!product.reviewCount && product.rating && <div className="mt-1"><Stars value={product.rating} count={product.reviewCount} size={12} /></div>}
        {multi && <p className="mt-0.5 text-xs text-muted">{product.variantCount} {t("options")}</p>}
        <ShipBadge p={product as Parameters<typeof ShipBadge>[0]["p"]} className="mt-1.5 self-start" />
        <div className="mt-auto pt-2">
          <div className="flex items-baseline gap-2">
            <span className={`font-semibold ${pct ? "text-sale" : ""}`}>
              {multi && product.priceMax && product.priceMax > product.price ? `${t("From")} ` : ""}
              {money(product.price)}
            </span>
            {pct && <span className="text-xs text-muted line-through">{money(product.compareAt!)}</span>}
          </div>
          {!product.inStock ? (
            <button disabled className="tap mt-2 w-full cursor-not-allowed rounded-lg bg-line py-2 text-sm font-semibold text-muted">{t("Sold out")}</button>
          ) : multi ? (
            <Link href={href} className="buy-alt tap mt-2 block w-full rounded-lg border border-brand-500 py-2 text-center text-sm font-semibold text-brand-600 transition hover:bg-brand-50">
              {t("Choose option")}
            </Link>
          ) : (
            <button onClick={() => add(product)} className="buy tap mt-2 w-full rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
              {t("Add to cart")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
