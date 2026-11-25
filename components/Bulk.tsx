"use client";

import { money } from "@/lib/format";
import { useGrowth, useT } from "@/lib/site-context";
import { useShop } from "@/lib/store";

/** Product page: buy 1, 2 or 3 — the bulk price is shown live and picking a tile sets the quantity.
 *  Same % as Subscribe & save every 3 months, paid now; up to N discounted per product per day. */
export function BulkOffer({ price, qty, onQty }: { price: number; qty: number; onQty: (n: number) => void }) {
  const t = useT();
  const g = useGrowth().bulk;
  const biz = useShop().quote?.bulk;
  // An authorized business buyer (known by the phone in the bag) sees their own price.
  const b = biz?.business ? { enabled: true, pct: biz.pct, maxUnits: Math.min(3, biz.maxUnits), min: biz.minQty ?? 1 } : g ? { ...g, min: 2 } : null;
  if (!b?.enabled || !b.pct) return null;
  const tiles = Array.from({ length: b.maxUnits }, (_, i) => i + 1);
  return (
    <div className="mt-4 rounded-2xl border border-[#f3c4d2] bg-gradient-to-br from-[#fff5f8] to-white p-3">
      <p className="text-sm font-bold">📦 {biz?.business ? `${t("Business price")} · ${biz.business}` : t("Bulk buy")}: <span className="text-[#9b2c50]">{b.pct}% {b.min > 1 ? t("off from 2 items") : t("off every item")}</span></p>
      <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
        {tiles.map((n) => {
          const full = price * n;
          const off = n >= b.min ? +((full * b.pct) / 100).toFixed(2) : 0;
          const on = qty === n || (n === b.maxUnits && qty > b.maxUnits);
          return (
            <button key={n} type="button" onClick={() => onQty(n)} aria-pressed={on} className={`rounded-xl border-2 px-2 py-2 text-center transition ${on ? "border-[#9b2c50] bg-white shadow-sm" : "border-transparent bg-white/70 hover:border-[#f3c4d2]"}`}>
              <span className="block text-xs font-semibold text-muted">{n} {n === 1 ? t("item") : t("items")}</span>
              <span className="block text-base font-bold">{money(full - off)}</span>
              {off > 0 ? <span className="mt-0.5 inline-block rounded-full bg-[#046c4e] px-1.5 text-[10px] font-bold text-white">{t("Save")} {money(off)}</span> : <span className="block text-[10px] text-muted">&nbsp;</span>}
            </button>
          );
        })}
      </div>
      {biz?.business ? <p className="mt-2 text-[11px] leading-snug text-muted">{t("Your approved business price, applied at checkout.")}</p> : <p className="mt-2 text-[11px] leading-snug text-muted">{t("Same saving as Subscribe & save every 3 months, without subscribing: paid now, on this order.")} {t("Up to")} {b.maxUnits} {t("per product a day")}.</p>}
    </div>
  );
}

/** Bag and checkout: the live bulk saving on a line, or how to get it. */
export function BulkNote({ productId, qty, every, className = "" }: { productId: string; qty: number; every?: number; className?: string }) {
  const t = useT();
  const g = useGrowth().bulk;
  const { quote } = useShop();
  const b = quote?.bulk?.business ? { enabled: true, pct: quote.bulk.pct } : g;
  if (!b?.enabled || !b.pct || every) return null;
  const l = quote?.lines.find((x) => x.productId === productId);
  if (l?.matchWas) return null; // SuperPrice items already have their own price
  const info = l?.bulk;
  if (info && info.saving > 0)
    return <p className={`sp-in rounded-lg bg-[#e6f4ee] px-2 py-1 text-[11px] font-semibold text-[#046c4e] ${className}`}>📦 {info.business ? t("Business price") : t("Bulk buy")} −{info.pct}% {t("on")} {info.units} · {t("you save")} {money(info.saving)}</p>;
  if (info && info.left === 0) return <p className={`text-[11px] text-muted ${className}`}>{t("Bulk discount already used today for this product")}</p>;
  if (qty === 1 && !quote?.bulk?.business) return <p className={`text-[11px] font-semibold text-[#9b2c50] ${className}`}>📦 {t("Add 1 more and save")} {b.pct}% {t("(bulk buy, paid now)")}</p>;
  return null;
}
