"use client";

import { cleanName } from "@/lib/data/catalog";
import { LinePlan } from "@/components/SubscribePlan";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/site-context";

import Link from "next/link";
import { Qty } from "@/components/CartDrawer";
import { CouponBox, GiftPicker, Totals } from "@/components/CartPromos";
import { FreeDeliveryBar, RecentlyViewed } from "@/components/Growth";
import { ProductCarousel } from "@/components/ProductCarousel";
import { ProductImage } from "@/components/ProductImage";
import { DeliverySplit, ShipBadge } from "@/components/ShipBadge";
import { PriceMatchBadge } from "@/components/PriceMatch";
import { BulkNote } from "@/components/Bulk";
import { SuperPrimeTeaser } from "@/components/SuperPrime";
import type { CardItem } from "@/lib/listing";
import { money } from "@/lib/format";
import { useShop } from "@/lib/store";

export default function CartPage() {
  const tx = useT();
  const { detailed, setQty, remove, add, setDrawerOpen, setCode, lines } = useShop();
  const linesRef = useRef(lines);
  linesRef.current = lines;

  // Link from the "you left something in your bag" message: refill the bag once.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("restore");
    if (!t) return;
    window.history.replaceState(null, "", window.location.pathname);
    fetch(`/api/cart/restore/?t=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((d: { items: { qty: number; product: Parameters<typeof add>[0] }[]; code?: string }) => {
        for (const i of d.items) if (!linesRef.current.some((l) => l.productId === i.product.id)) add(i.product, i.qty);
        if (d.code) setCode(d.code);
        setDrawerOpen(false);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!detailed.length)
    return (
      <div className="container-x py-24 text-center">
        <h1 className="text-3xl font-semibold">Your bag is empty</h1>
        <Link href="/shop/" className="mt-6 inline-block rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white">{tx("Start shopping")}</Link>
        <div className="mt-10 text-start"><RecentlyViewed /></div>
        <EmptyBagPicks />
      </div>
    );

  return (
    <div className="container-x grid gap-10 py-10 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="mb-4 text-3xl font-semibold">{tx("Your bag")}</h1>
        <div className="mb-6"><FreeDeliveryBar /></div>
        <ul className="divide-y divide-line border-y border-line">
          {detailed.map(({ product, qty, lineTotal, every, start, forMonths }) => (
            <li key={product.id} className="flex gap-4 py-5">
              <ProductImage product={product} className="h-24 w-24 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col">
                <p className="text-xs font-semibold uppercase text-muted">{product.brand}</p>
                <Link href={`/products/${product.slug}/`} className="font-medium hover:text-brand-600">{cleanName(product.name)}</Link>
                <p className="text-sm text-muted">{money(product.price)}{product.variant ? ` · ${product.variant}` : product.size ? ` · ${product.size}` : ""}</p>
                <ShipBadge quiet p={product} className="mt-1 self-start" />
                    <PriceMatchBadge p={product} className="mt-1 self-start" />
                <LinePlan name={product.name} productId={product.id} every={every} start={start} forMonths={forMonths} />
                <BulkNote productId={product.id} qty={qty} every={every} className="mt-1 self-start" />
                <div className="mt-auto flex items-center gap-4">
                  <Qty qty={qty} onChange={(n) => setQty(product.id, n)} />
                  <button onClick={() => remove(product.id)} className="text-sm text-muted hover:underline">{tx("Remove")}</button>
                </div>
              </div>
              <p className="font-semibold">{money(lineTotal)}</p>
            </li>
          ))}
        </ul>
        <DeliverySplit items={detailed.map((l) => l.product)} className="mt-4" />
        <div className="mt-6"><GiftPicker /></div>
      </div>
      <aside className="summary-box h-fit rounded-2xl border border-line p-6 lg:sticky lg:top-32">
        <h2 className="text-lg font-semibold">{tx("Order summary")}</h2>
        <div className="mt-4"><SuperPrimeTeaser className="mb-3" />
          <CouponBox /></div>
        <div className="mt-4"><Totals /></div>
        <Link href="/checkout/" className="mt-5 block rounded-lg bg-brand-500 py-3 text-center font-semibold text-white hover:bg-brand-600">{tx("Checkout")}</Link>
      </aside>
    </div>
  );
}

/** The empty bag is not a dead end: show what sells best right now. */
function EmptyBagPicks() {
  const tx = useT();
  const [items, setItems] = useState<CardItem[]>([]);
  useEffect(() => {
    fetch("/api/products/picks/").then((r) => r.json()).then((d: { items: CardItem[] }) => setItems(d.items ?? [])).catch(() => {});
  }, []);
  return <div className="text-start"><ProductCarousel eyebrow={tx("Popular now")} title={tx("Best-sellers")} products={items} href="/shop/" /></div>;
}
