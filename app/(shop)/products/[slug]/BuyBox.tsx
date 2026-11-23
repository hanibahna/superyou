"use client";

import { ShareButton } from "@/components/ShareButton";
import { SubscribeChoice } from "@/components/SubscribePlan";
import type { Every } from "@/lib/every";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { track } from "@/lib/track";
import { Qty } from "@/components/CartDrawer";
import { HeartIcon } from "@/components/Icons";
import { ProductImage } from "@/components/ProductImage";
import { cleanName, fullName, discountPct, type ProductLite } from "@/lib/data/catalog";
import { money } from "@/lib/format";
import { imgUrl } from "@/lib/img";
import { PharmacistButton, TrackView } from "@/components/Growth";
import { Stars } from "@/components/Stars";
import { deliveryBy } from "@/lib/growth";
import { localeOf } from "@/lib/i18n";
import { useGrowth, useLang, useSettings, useT } from "@/lib/site-context";
import { snap, useShop } from "@/lib/store";
import { ShipBadge } from "@/components/ShipBadge";

export function BuyBox({
  variants,
  initialId,
  gallery,
  concernNames,
  freeOver,
  children,
  subOk = true,
  life = null,
  underImage,
}: {
  subOk?: boolean;
  life?: { days: number; every: Every; basis: string } | null;
  underImage?: React.ReactNode;
  variants: ProductLite[];
  initialId: string;
  gallery: string[];
  concernNames: Record<string, string>;
  freeOver: string;
  children: ReactNode;
}) {
  const tx = useT();
  const { add, toggleWish, isWished } = useShop();
  const [id, setId] = useState(initialId);
  const [qty, setQty] = useState(1);
  const [plan, setPlan] = useState<0 | Every>(0);
  const v = variants.find((x) => x.id === id) ?? variants[0];
  const [shown, setShown] = useState<string | undefined>(v.image ?? gallery[0]);
  const pct = discountPct(v);
  const wished = isWished(v.id);
  useEffect(() => track({ type: "view_item", item: { id: v.id, name: v.name, brand: v.brand, price: v.price } }), [v.id, v.name, v.brand, v.price]);
  const t = useT();
  const lang = useLang();
  const growth = useGrowth();
  const settings = useSettings();
  const rating = variants.find((x) => x.reviewCount)?.rating;
  const reviewCount = variants.find((x) => x.reviewCount)?.reviewCount ?? 0;
  const by = deliveryBy(v.daysMax ? String(v.daysMax) : settings.delivery.estimate || "3").toLocaleDateString(localeOf(lang), { weekday: "short", day: "numeric", month: "short" });

  const pick = (x: ProductLite) => {
    setId(x.id);
    if (x.image) setShown(x.image);
    const u = new URL(window.location.href);
    u.searchParams.set("v", x.id);
    window.history.replaceState(null, "", u.toString());
  };

  return (
    // Phones: photos, then name, price and Add to bag, then pharmacist, how-to and videos.
    // Desktop: photos and extras on the left, the buy column on the right.
    <div className="grid gap-6 md:grid-cols-2 md:grid-rows-[auto_1fr] md:gap-x-10 md:gap-y-0">
      <div className="relative order-1 md:col-start-1 md:row-start-1">
        <TrackView product={snap(variants.find((x) => x.inStock) ?? v)} />
        {pct && <span dir="ltr" className="absolute start-4 top-4 z-10 rounded-md bg-sale px-2.5 py-1 text-sm font-bold text-white">-{pct}%</span>}
        <ProductImage product={{ ...v, image: shown }} width={1000} className="pdp-main aspect-square w-full rounded-2xl border border-line" />
        {gallery.length > 1 && (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto md:grid md:grid-cols-5">
            {gallery.slice(0, 10).map((src) => (
              <button key={src} onClick={() => setShown(src)} className={`w-16 shrink-0 overflow-hidden rounded-lg border md:w-auto ${shown === src ? "border-brand-500 ring-1 ring-brand-500" : "border-line"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl(src, 160)} alt="" className="aspect-square w-full bg-white object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* On phones this wrapper "disappears" (display: contents) so its two parts can sit either side of the extras. */}
      <div className="contents md:col-start-2 md:row-span-2 md:row-start-1 md:block">
        <div className="order-2">
        <Link href={`/shop/?brand=${encodeURIComponent(v.brand)}`} className="pdp-brand text-sm font-bold uppercase tracking-wider text-brand-600 hover:underline">{v.brand}</Link>
        <h1 className="pdp-title mt-1 text-2xl font-semibold leading-tight md:text-3xl">{cleanName(v.name)}</h1>
        {growth.reviews.enabled && reviewCount >= 3 && (
          <a href="#reviews" className="mt-1 inline-flex items-center gap-2 text-sm hover:underline">
            {rating ? <><Stars value={rating} size={15} /> <span>{rating.toFixed(1)} · {reviewCount} {t("Reviews")}</span></> : <span className="text-muted">{t("Write a review")}</span>}
          </a>
        )}
        {(v.variant || v.size) && <p className="mt-1 text-sm text-muted">{v.variant ?? v.size}</p>}

        <div className="mt-4 flex flex-wrap items-baseline gap-3">
          <span className={`pdp-price text-3xl font-bold ${pct ? "text-sale" : ""}`}>{money(v.price)}</span>
          {pct && <span className="text-lg text-muted line-through">{money(v.compareAt!)}</span>}
          {pct && <span className="rounded bg-sale/10 px-2 py-0.5 text-sm font-semibold text-sale">Save {money(v.compareAt! - v.price)}</span>}
        </div>

        {variants.length > 1 && (
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold">{t("Choose an option")}</p>
            <div className="flex flex-wrap gap-2">
              {variants.map((x) => (
                <button
                  key={x.id}
                  onClick={() => pick(x)}
                  className={`pdp-opt rounded-lg border px-3 py-2 text-sm ${x.id === v.id ? "border-brand-500 bg-brand-50 font-semibold text-brand-700" : "border-line hover:border-ink"} ${x.inStock ? "" : "text-muted line-through decoration-1"}`}
                >
                  {x.variant ?? x.size ?? x.sku}
                  <span className="ml-1.5 text-xs text-muted no-underline">{money(x.price)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {v.concerns.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {v.concerns.map((c) => (
              <Link key={c} href={`/shop/?concern=${c}`} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">{concernNames[c] ?? c}</Link>
            ))}
          </div>
        )}

        {v.inStock && subOk && <SubscribeChoice price={v.price} value={plan} onChange={setPlan} life={life} />}
        <div className="mt-6 flex items-center gap-3">
          {v.inStock ? (
            <>
              <Qty qty={qty} onChange={(n) => setQty(Math.max(1, n))} />
              <button onClick={() => add(v, qty, plan || null)} className="tap flex-1 rounded-lg bg-brand-500 py-3 font-semibold text-white hover:bg-brand-600">{plan ? t("Subscribe") : t("Add to cart")}</button>
            </>
          ) : (
            <button disabled className="flex-1 rounded-lg bg-line py-3 font-semibold text-muted">{t("Sold out")}</button>
          )}
          <button onClick={() => toggleWish(v)} aria-label={tx("Wishlist")} className={`rounded-lg border border-line p-3 ${wished ? "text-sale" : "text-muted hover:text-ink"}`}>
            <HeartIcon filled={wished} />
          </button>
          <ShareButton compact title={`${fullName(v.brand, v.name)}`} text={`${fullName(v.brand, v.name)} at SuperYou`} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ShipBadge p={v} size="md" />
          {v.inStock && <p className="text-sm">🚚 {t("Order now, delivered by")} <b>{by}</b></p>}
        </div>
        {v.origin === "international" && (
          <p className="mt-2 rounded-lg border border-[#c7d2fe] bg-[#eef2ff] p-3 text-xs leading-relaxed text-[#312e81]">
            {t("Imported for you from")} {v.shipFrom || t("abroad")}. {t("The price already includes international shipping, customs duty and VAT, with nothing more to pay at the door. Original product, ordered from an authorised supplier when you place your order.")}
          </p>
        )}
        <ul className="pdp-trust mt-4 space-y-2 rounded-xl bg-[#f7f8f7] p-4 text-sm">
          {growth.trust.lines.map((l) => <li key={l}>✓ {l}</li>)}
          {freeOver && <li>✓ {t("Free delivery on orders over")} {freeOver}</li>}
          <li>✓ {t("Pay cash on delivery, by card or with Whish")}</li>
        </ul>
        {growth.trust.returnsSummary && <p className="mt-2 text-xs text-muted">{growth.trust.returnsSummary}</p>}
        {/* Sticky buy bar on phones */}
        {v.inStock && (
          <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 border-t border-line bg-white px-4 py-2.5 md:hidden">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted">{v.brand}</p>
              <p className={`font-bold ${pct ? "text-sale" : ""}`}>{money(v.price)}</p>
            </div>
            <button onClick={() => add(v, qty, plan || null)} className="tap rounded-full bg-ink px-6 font-semibold text-white">{plan ? t("Subscribe") : t("Add to bag")}</button>
          </div>
        )}
        </div>
        <div className="order-4">{children}</div>
      </div>

      {/* Under the photos (after the buy column on phones): Ask a pharmacist, then How to use and Videos. */}
      <div className="order-3 self-start md:col-start-1 md:row-start-2">
        <PharmacistButton product={`${fullName(v.brand, v.name)}${v.variant ? ` (${v.variant})` : ""}`} className="mt-3 rounded-2xl border-2 bg-white p-3" />
        {underImage}
      </div>
    </div>
  );
}
