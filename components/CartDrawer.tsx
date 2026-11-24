"use client";

import { cleanName } from "@/lib/data/catalog";
import { LinePlan } from "./SubscribePlan";
import Link from "next/link";
import { useT } from "@/lib/site-context";
import { RewardLadder } from "./RewardLadder";
import { CouponBox, GiftPicker, Totals } from "./CartPromos";
import { money } from "@/lib/format";
import { useShop } from "@/lib/store";
import { CloseIcon } from "./Icons";
import { ProductImage } from "./ProductImage";
import { DeliverySplit, ShipBadge } from "./ShipBadge";
import { PriceMatchBadge } from "./PriceMatch";

export function CartDrawer() {
  const tx = useT();
  const { drawerOpen, setDrawerOpen, detailed, subtotal, setQty, remove } = useShop();
  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="text-lg font-semibold">{tx("Your cart")}</h2>
          <button onClick={() => setDrawerOpen(false)} aria-label="Close cart">
            <CloseIcon />
          </button>
        </div>

        <RewardLadder />

        <div className="flex-1 overflow-y-auto p-5">
          {detailed.length === 0 ? (
            <p className="py-16 text-center text-muted">Your cart is empty.</p>
          ) : (
            <ul className="space-y-4">
              {detailed.map(({ product, qty, lineTotal, every }) => (
                <li key={product.id} className="flex gap-3">
                  <ProductImage product={product} className="h-20 w-20 shrink-0 rounded-lg" />
                  <div className="flex flex-1 flex-col">
                    <p className="text-xs font-semibold uppercase text-muted">{product.brand}</p>
                    <p className="text-sm font-medium leading-snug">{cleanName(product.name)}</p>
                    {product.variant && <p className="text-xs text-muted">{product.variant}</p>}
                    <ShipBadge p={product} className="mt-1 self-start" />
                    <PriceMatchBadge p={product} className="mt-1 self-start" />
                    <LinePlan name={product.name} productId={product.id} every={every} />
                    <div className="mt-auto flex items-center justify-between">
                      <Qty qty={qty} onChange={(n) => setQty(product.id, n)} />
                      <span className="text-right text-sm font-semibold">
                        {product.compareAt && product.compareAt > product.price && <span className="mr-1 text-xs font-normal text-muted line-through">{money(product.compareAt * qty)}</span>}
                        {money(lineTotal)}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => remove(product.id)} className="self-start text-muted hover:text-ink" aria-label={tx("Remove")}>
                    <CloseIcon width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {detailed.length > 0 && (
            <DeliverySplit items={detailed.map((l) => l.product)} className="mt-4" />
          )}
          {detailed.length > 0 && <div className="mt-5"><GiftPicker compact /></div>}
        </div>

        {detailed.length > 0 && (
          <div className="border-t border-line p-5">
            <CouponBox />
            <div className="my-3"><Totals /></div>
            <Link
              href="/checkout/"
              onClick={() => setDrawerOpen(false)}
              className="block rounded-lg bg-brand-500 py-3 text-center font-semibold text-white hover:bg-brand-600"
            >
              {tx("Checkout")}
            </Link>
            <Link href="/cart/" onClick={() => setDrawerOpen(false)} className="mt-2 block text-center text-sm text-muted hover:underline">
              View full cart
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

export function Qty({ qty, onChange }: { qty: number; onChange: (n: number) => void }) {
  const tx = useT();
  return (
    <div className="flex items-center rounded-lg border border-line">
      <button onClick={() => onChange(qty - 1)} className="px-2.5 py-1 text-muted hover:text-ink" aria-label={tx("Decrease")}>−</button>
      <span className="w-6 text-center text-sm">{qty}</span>
      <button onClick={() => onChange(qty + 1)} className="px-2.5 py-1 text-muted hover:text-ink" aria-label={tx("Increase")}>+</button>
    </div>
  );
}
