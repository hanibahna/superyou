"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import { useSettings, useT } from "@/lib/site-context";
import { useShop } from "@/lib/store";
import { GiftIcon } from "./Icons";
import { ProductImage } from "./ProductImage";

/** Free-gift tiers: progress towards each one, then a choice of gifts once unlocked. */
export function GiftPicker({ compact = false }: { compact?: boolean }) {
  const tx = useT();
  const { quote, giftPicks, toggleGift } = useShop();
  const tiers = quote?.gifts ?? [];
  if (!tiers.length) return null;
  return (
    <div className="space-y-3">
      {tiers.map((t) => {
        const chosen = giftPicks[t.id] ?? [];
        if (!t.unlocked)
          return t.showProgress ? (
            <div key={t.id} className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm">
              <GiftIcon width={18} height={18} className="shrink-0 text-brand-600" />
              <span>{tx("Spend")} <b>{money(t.remaining)}</b> more to get <b>{t.name}</b></span>
            </div>
          ) : null;
        return (
          <div key={t.id} className="rounded-xl border border-brand-500/40 bg-brand-50 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
              <GiftIcon width={18} height={18} /> {t.name} unlocked!
              <span className="ml-auto text-xs font-normal text-muted">Choose {t.pick} · {chosen.length}/{t.pick}</span>
            </p>
            <div className={`mt-2 grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-4"}`}>
              {t.options.map((o) => {
                const on = chosen.includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggleGift(t.id, o.id, t.pick)}
                    disabled={!o.inStock}
                    className={`rounded-lg border bg-white p-1.5 text-left text-[11px] leading-tight transition disabled:opacity-40 ${on ? "border-brand-500 ring-2 ring-brand-500" : "border-line hover:border-brand-500"}`}
                  >
                    <ProductImage product={o} width={160} className="aspect-square w-full rounded" />
                    <span className="mt-1 line-clamp-2 block">{o.name}</span>
                    <span className="font-semibold text-brand-700">{on ? tx("✓ Selected") : tx("Free")}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CouponBox() {
  const tx = useT();
  const { code, setCode, quote } = useShop();
  const [v, setV] = useState(code);
  const applied = code && quote && !quote.couponError && quote.discounts.some((d) => d.code?.toLowerCase() === code.toLowerCase());
  return (
    <div>
      <form onSubmit={(e) => (e.preventDefault(), setCode(v.trim()))} className="flex gap-2">
        <input value={v} onChange={(e) => setV(e.target.value.toUpperCase())} placeholder="Discount code" aria-label="Discount code" className="w-full rounded-lg border border-line px-3 py-2 text-sm uppercase outline-none focus:border-brand-500" />
        {code ? (
          <button type="button" onClick={() => (setCode(""), setV(""))} className="rounded-lg border border-line px-3 text-sm">{tx("Remove")}</button>
        ) : (
          <button className="rounded-lg border border-line px-4 text-sm font-semibold hover:bg-brand-50">{tx("Apply")}</button>
        )}
      </form>
      {code && quote?.couponError && <p className="mt-1 text-xs text-sale">{quote.couponError}</p>}
      {applied && <p className="mt-1 text-xs font-semibold text-brand-700">Code {code} applied</p>}
    </div>
  );
}

export function Totals({ big = false }: { big?: boolean }) {
  const tx = useT();
  const { subtotal, delivery, total, quote, lines } = useShop();
  const s = useSettings();
  const saleSavings = lines.reduce((sum, l) => sum + (l.product.compareAt && l.product.compareAt > l.product.price ? (l.product.compareAt - l.product.price) * l.qty : 0), 0);
  const minOrder = quote?.minOrder ?? s.checkout.minOrder;
  return (
    <dl className={`space-y-2 text-sm ${big ? "" : ""}`}>
      <div className="flex justify-between"><dt>{tx("Subtotal")}</dt><dd>{money(subtotal)}</dd></div>
      {quote?.discounts.map((d) => (
        <div key={d.name + d.code} className="flex justify-between text-brand-700"><dt>{d.name}{d.code ? ` (${d.code})` : ""}</dt><dd>−{money(d.amount)}</dd></div>
      ))}
      <div className="flex justify-between"><dt>{tx("Delivery")}</dt><dd>{delivery === 0 ? tx("Free") : money(delivery)}</dd></div>
      <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>{tx("Total")}</dt><dd>{money(total)}</dd></div>
      {saleSavings > 0 && <p className="text-xs text-brand-700">You're saving {money(saleSavings + (quote?.discountTotal ?? 0))} on this order</p>}
      {minOrder > 0 && subtotal < minOrder && <p className="text-xs text-sale">Minimum order is {money(minOrder)}</p>}
    </dl>
  );
}
