"use client";

// SuperPrice Guaranteed: an item another shop sells for less is sold here for less again
// (5% below, never under cost + margin). Prices are compared every night at 3 am (Beirut).
import { useEffect, useState } from "react";
import { money } from "@/lib/format";
import { useGrowth, useT } from "@/lib/site-context";

type SP = { match?: string; matchWas?: number; matchVs?: number; price?: number; spLimit?: number; cmpVs?: number; cmpShop?: string };

/** Next nightly price check: 01:00 UTC (3 am in Beirut). */
function nextCheck(now = Date.now()) {
  const d = new Date(now);
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 1, 0, 0);
  return t > now ? t : t + 86400_000;
}

function useCountdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(nextCheck() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (left === null) return "";
  const s = Math.max(0, Math.floor(left / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

const Mark = () => (
  <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full bg-[#c0587a] text-[9px] font-black text-white">S</span>
);

/** Small pill: "SuperPrice" (+ the shop on larger sizes). */
export function PriceMatchBadge({ p, size = "sm", className = "" }: { p: SP; size?: "sm" | "md"; className?: string }) {
  const t = useT();
  if (p.spLimit) return <span className={`inline-flex rounded-full bg-[#fdecef] px-2 py-0.5 text-[11px] font-semibold text-[#9b2c50] ${className}`}>{t("SuperPrice is for up to")} {p.spLimit} {t("per order")}</span>;
  if (p.match === undefined) return null;
  const cls = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  return (
    <span title={p.match ? `${t("Cheaper than")} ${p.match}` : t("Cheaper than other shops")} className={`sp-shine inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full bg-[#fdecef] font-semibold text-[#9b2c50] ${cls} ${className}`}>
      <Mark />
      SuperPrice{size === "md" && p.match ? ` · ${t("below")} ${p.match}` : ""}
    </span>
  );
}

/** Product page, every product: the nightly comparison, revealed with a short animation.
 *  SuperPrice (we lowered ours), already the best price, or not sold at the other shops. */
export function SuperPriceCard({ p, className = "" }: { p: SP; className?: string }) {
  const t = useT();
  const on = !!useGrowth().superPrice;
  const [stage, setStage] = useState(0);
  useEffect(() => {
    setStage(0);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setStage(2);
    const a = setTimeout(() => setStage(1), 900);
    const b = setTimeout(() => setStage(2), 1700);
    return () => (clearTimeout(a), clearTimeout(b));
  }, [p.price]);
  if (!on || !p.price) return null;
  const lowered = !!p.matchWas && p.match !== undefined;
  const vs = lowered ? p.matchVs : p.cmpVs;
  const shop = (lowered ? p.match : p.cmpShop) || t("Another shop");
  return (
    <div className={`overflow-hidden rounded-xl border border-[#f3c4d2] bg-gradient-to-r from-[#fff5f8] to-white p-3 text-sm ${className}`}>
      <p className="flex items-center gap-2 font-semibold text-[#9b2c50]">
        <Mark /> SuperPrice Guaranteed
        {stage >= 2 && <span className="sp-pop grid h-4 w-4 place-items-center rounded-full bg-[#046c4e] text-[10px] text-white" aria-hidden>✓</span>}
      </p>
      {stage === 0 && (
        <p className="mt-1 flex items-center gap-2 text-xs text-muted">
          <span className="sp-scan relative h-1 w-16 overflow-hidden rounded-full bg-[#f3c4d2]" aria-hidden />
          {t("Comparing prices with other shops in Lebanon…")}
        </p>
      )}
      {stage >= 1 && vs !== undefined && (
        <p className="sp-in mt-1 text-xs text-muted">
          {shop}: <span className={lowered ? "line-through" : ""}>{money(vs)}</span>
          {stage >= 2 && <span className="sp-pop ml-2 font-bold text-ink">SuperYou: {money(p.price)}</span>}
        </p>
      )}
      {stage >= 2 && (
        <p className="sp-in mt-1 text-[11px] text-muted">
          {lowered
            ? t("We lowered our price below theirs. Checked every night; limited quantity per order, one SuperPrice order a day.")
            : vs !== undefined
              ? vs - p.price > 0.009
                ? `${t("Already the best price:")} ${money(vs - p.price)} ${t("less here. Checked every night.")}`
                : t("Same best price. Checked every night.")
              : t("No lower price found in tonight's check. Checked every night.")}
        </p>
      )}
    </div>
  );
}

/** Bag: shown once for the item just added. */
export function SuperPriceReveal({ p }: { p: SP & { name: string } }) {
  const t = useT();
  const [done, setDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDone(true), 1400);
    return () => clearTimeout(id);
  }, []);
  if (!p.matchWas || p.match === undefined || !p.price) return null;
  const saved = (p.matchVs ?? p.matchWas) - p.price;
  return (
    <div className="sp-in mx-5 mt-4 rounded-xl border border-[#f3c4d2] bg-[#fff5f8] p-3 text-sm" role="status">
      <p className="flex items-center gap-2 font-semibold text-[#9b2c50]"><Mark /> {done ? "SuperPrice Guaranteed" : t("Checking the best price…")}</p>
      {done && (
        <p className="sp-pop mt-1 text-xs">
          {p.match ? `${p.match} ${t("sells it for")}` : t("Another shop sells it for")} {money(p.matchVs ?? 0)}. {t("You pay")} <b>{money(p.price)}</b>{saved > 0.009 ? ` (${money(saved)} ${t("less")})` : ""}.
        </p>
      )}
    </div>
  );
}

/** Checkout: total SuperPrice saving, and how long the prices are held. */
export function PriceGuaranteeNote({ items, className = "" }: { items: (SP & { qty?: number })[]; className?: string }) {
  const t = useT();
  const left = useCountdown();
  const sp = items.filter((i) => i.matchWas && i.match !== undefined && i.price);
  if (!sp.length) return null;
  const saved = sp.reduce((s, i) => s + ((i.matchVs ?? i.matchWas!) - i.price!) * (i.qty ?? 1), 0);
  const shops = [...new Set(sp.map((i) => i.match).filter(Boolean))];
  return (
    <div className={`sp-in rounded-xl border border-[#f3c4d2] bg-gradient-to-r from-[#fff5f8] to-white p-3 text-xs leading-relaxed ${className}`}>
      <p className="flex items-center gap-2 text-sm font-semibold text-[#9b2c50]"><Mark /> SuperPrice Guaranteed</p>
      <p className="mt-1">
        {sp.length} {sp.length === 1 ? t("item is") : t("items are")} {t("cheaper here than at")} {shops.length ? shops.join(", ") : t("other shops in Lebanon")}
        {saved > 0.009 && <> · <b>{money(saved)}</b> {t("less")}</>}.
      </p>
      {left && <p className="mt-1 text-muted">{t("SuperPrices held for")} <b className="tabular-nums text-ink">{left}</b> {t("(next price check at 3 am). One SuperPrice order per customer a day.")}</p>}
    </div>
  );
}

/** Sticker on the Add to cart button, on every product: the SuperPrice promise, with a short
 *  explanation on tap. Animated (shine + gentle bob); still for visitors who reduce motion. */
export function SuperPriceSticker({ p }: { p: SP }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const cheaper = !!p.matchWas && p.match !== undefined;
  return (
    <span className="absolute -top-3 right-2 z-10">
      <button
        type="button"
        onClick={(e) => (e.stopPropagation(), setOpen((o) => !o))}
        aria-expanded={open}
        className="sp-bob sp-shine flex items-center gap-1 whitespace-nowrap rounded-full border border-[#f3c4d2] bg-[#fdecef] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9b2c50] shadow-sm"
      >
        <Mark /> SuperPrice {t("Guaranteed")}
      </button>
      {open && (
        <span role="dialog" className="sp-in absolute right-0 top-7 w-64 rounded-xl border border-line bg-white p-3 text-left text-xs font-normal normal-case leading-relaxed text-ink shadow-lg">
          <b className="flex items-center gap-1.5 text-[#9b2c50]"><Mark /> SuperPrice Guaranteed</b>
          <span className="mt-1 block">
            {cheaper
              ? `${p.match || t("Another shop")} ${t("sells it for")} ${money(p.matchVs ?? 0)}. ${t("Here it's")} ${money(p.price ?? 0)}.`
              : p.cmpVs !== undefined
                ? `${t("Price compared:")} ${p.cmpShop || t("another shop")} ${money(p.cmpVs)}, SuperYou ${money(p.price ?? 0)}.`
                : t("We compare our prices with other shops in Lebanon every night. When one sells it for less, we drop ours below theirs.")}
          </span>
          <span className="mt-1 block text-muted">{t("Original products only. Limited quantity per order; one SuperPrice order a day.")}</span>
        </span>
      )}
    </span>
  );
}
