"use client";

// SuperPrice Guaranteed: an item another shop sells for less is sold here for less again
// (3% below, never under cost + margin). Prices are compared every night at 3 am (Beirut).
import { useEffect, useState } from "react";
import { money } from "@/lib/format";
import { useGrowth, useT } from "@/lib/site-context";

type SP = { match?: string; matchWas?: number; matchVs?: number; price?: number; spLimit?: number; cmpVs?: number; cmpShop?: string; shops?: [string, number][]; beat?: "full" | "partial" | "none" };

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
  const cls = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  // Product page: one sticker for every shop we're cheaper than (SuperPrice or already cheaper).
  if (size === "md" && p.shops?.length && p.price) {
    const below = p.shops.filter(([, x]) => x - p.price! > 0.009);
    if (below.length)
      return (
        <>
          {below.map(([name, x], i) => (
            <span key={i} title={`${name || t("Another shop")}: ${money(x)}`} className={`sp-shine sp-in inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full bg-[#fdecef] font-semibold text-[#9b2c50] ${cls} ${className}`} style={{ animationDelay: `${i * 0.12}s` }}>
              <Mark />
              SuperPrice · {t("below")} {name || t("another shop")}
            </span>
          ))}
        </>
      );
  }
  if (p.match === undefined) return null;
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
    // Shops appear one by one, then each shows its verdict.
    const a = setTimeout(() => setStage(1), 900);
    const b = setTimeout(() => setStage(2), 1300 + Math.min(p.shops?.length ?? 1, 8) * 280);
    return () => (clearTimeout(a), clearTimeout(b));
  }, [p.price, p.shops?.length]);
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
      {stage >= 1 && (p.shops?.length ? (
        <ul className="sp-in mt-1.5 space-y-0.5 text-xs">
          {p.shops.map(([name, price], i) => {
            const d = price - (p.price ?? 0);
            const before = p.matchWas ?? p.price ?? 0;
            // Already cheaper than them at our normal price, or we took a little off to get below them.
            const tookOff = lowered && price <= before * 1.005;
            return (
              <li key={i} className="sp-in rounded-lg px-1.5 py-1 text-muted odd:bg-[#fff0f4]/60" style={{ animationDelay: `${i * 0.28}s` }}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-ink">{name || t("Another shop")}</span>
                  <span className="tabular-nums">
                    <span className={stage >= 2 && d > 0.009 ? "line-through decoration-[#c0587a]/60" : ""}>{money(price)}</span>
                  </span>
                </div>
                {stage < 2 ? (
                  <span className="sp-scan relative mt-1 block h-0.5 w-full overflow-hidden rounded-full bg-[#f3c4d2]" aria-hidden />
                ) : d > 0.009 ? (
                  <div className="sp-pop mt-0.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px]" style={{ animationDelay: `${i * 0.15}s` }}>
                    <span className={`rounded-full px-1.5 py-px font-semibold ${tookOff ? "bg-[#9b2c50] text-white" : "bg-[#e6f4ee] text-[#046c4e]"}`}>
                      {tookOff ? (Math.abs(price - before) < 0.01 * price ? t("Same price → we took extra off") : t("Cheaper there → we took extra off")) : t("Already cheaper here")}
                    </span>
                    <span className="font-bold text-[#046c4e]">{t("Beaten by")} {money(d)} · {fmtPct(d / price)}</span>
                  </div>
                ) : (
                  <div className="sp-pop mt-0.5 text-[11px] font-semibold text-ink">{t("Same price")}</div>
                )}
              </li>
            );
          })}
          {stage >= 2 && (
            <li className="sp-in flex justify-between gap-3 border-t border-[#f3c4d2] pt-1 font-bold text-ink">
              <span>SuperYou</span><span className="sp-pop tabular-nums">{money(p.price)}</span>
            </li>
          )}
        </ul>
      ) : vs !== undefined ? (
        <p className="sp-in mt-1 text-xs text-muted">
          {shop}: <span className={lowered ? "line-through" : ""}>{money(vs)}</span>
          {stage >= 2 && <span className="sp-pop ml-2 font-bold text-ink">SuperYou: {money(p.price)}</span>}
        </p>
      ) : null)}
      {stage >= 2 && <BeatLine p={p} vs={vs} lowered={lowered} />}
    </div>
  );
}

const fmtPct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** Who we beat, by how much ($ and %), and whether the extra discount below them was applied. */
function BeatLine({ p, vs, lowered }: { p: SP; vs?: number; lowered: boolean }) {
  const t = useT();
  if (vs === undefined || !p.price) return <NoCheaper />;
  const price = p.price;
  const shops = (p.shops?.length ? p.shops : [[lowered ? p.match ?? "" : p.cmpShop ?? "", vs] as [string, number]]).filter(([, x]) => x - price > 0.009);
  const who = shops.map(([n, x]) => `${n || t("another shop")} ${t("by")} ${money(x - price)} (${fmtPct((x - price) / x)})`);
  const list = who.length > 1 ? `${who.slice(0, -1).join(", ")} ${t("and")} ${who[who.length - 1]}` : who[0];
  const wasTie = lowered && Math.abs(vs - (p.matchWas ?? 0)) < 0.01 * vs;
  const status = lowered
    ? p.beat === "partial"
      ? t("Extra discount applied, as far as this item allows.")
      : wasTie
        ? t("Same price elsewhere, so we went lower.")
        : t("Cheaper elsewhere, so we went lower.")
    : "";
  return (
    <p className="sp-in mt-1.5 text-[11px] leading-relaxed">
      {list ? <b className="text-[#046c4e]">✓ {lowered ? t("Beats") : t("Cheaper than")} {list}.</b> : <b className="text-[#046c4e]">✓ {t("Same as the lowest price.")}</b>}{" "}
      <span className="text-muted">{status} {t("Checked every night.")}</span>
    </p>
  );
}

/** When the last nightly check ran, as "today at 3:00 am" / "2 h ago" (client-side, Beirut 3 am = 01:00 UTC). */
function useLastCheck() {
  const t = useT();
  const [v, setV] = useState("");
  useEffect(() => {
    const last = nextCheck() - 86400_000;
    const h = Math.floor((Date.now() - last) / 3600_000);
    setV(h < 1 ? t("less than an hour ago") : `${t("today at 3:00 am")} (${h} ${t("h ago")})`);
  }, [t]);
  return v;
}

/** No shop sells it for less: every shop checked ticks off one by one, then the verdict. */
function NoCheaper() {
  const t = useT();
  const g = useGrowth();
  const shops = g.superPriceShops ?? [];
  const [n, setN] = useState(0);
  const [all, setAll] = useState(false);
  const SHOW = 12;
  const lastCheck = useLastCheck();
  const list = all ? shops : shops.slice(0, SHOW);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setN(list.length + 1);
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i > list.length) clearInterval(id);
    }, 110);
    return () => clearInterval(id);
  }, [list.length]);
  if (!shops.length) return <p className="sp-in mt-1.5 text-[11px] text-muted">{t("No lower price found in tonight's check. Checked every night.")}</p>;
  const done = n > list.length;
  return (
    <div className="sp-in mt-2">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 36 36" className="h-11 w-11 shrink-0 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f3c4d2" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#046c4e" strokeWidth="3" strokeLinecap="round" strokeDasharray="97.4" strokeDashoffset={97.4 * (1 - Math.min(n, list.length) / Math.max(list.length, 1))} style={{ transition: "stroke-dashoffset .15s linear" }} />
        </svg>
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-tight text-ink">
            {done ? <span className="sp-pop">🏆 {t("Lowest price in Lebanon")}</span> : <>{t("Checking")} {Math.min(n, list.length)}/{list.length}…</>}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#d92d20] px-1.5 py-px text-[10px] font-black uppercase tracking-wider text-white">
              <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" /></span>
              Live
            </span>
            <span>{t("price watch on")} <b className="text-ink">{shops.length}</b> {t("online shops. None sells it for less.")} {lastCheck && <>{t("Last checked")} {lastCheck}.</>}</span>
          </p>
        </div>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {list.map((name, i) => (
          <li key={name} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all duration-300 ${i < n ? "border-[#bfe3d2] bg-[#e6f4ee] text-[#046c4e]" : "border-[#f3c4d2] bg-white text-muted opacity-60"}`}>
            {i < n ? <span className="sp-pop" aria-hidden>✓</span> : <span className="h-1.5 w-1.5 rounded-full bg-[#f3c4d2]" aria-hidden />}
            {name}
          </li>
        ))}
        {!all && shops.length > SHOW && (
          <li>
            <button type="button" onClick={() => setAll(true)} className="rounded-full border border-[#f3c4d2] bg-[#fdecef] px-2 py-0.5 text-[11px] font-semibold text-[#9b2c50]">
              +{shops.length - SHOW} {t("more")}
            </button>
          </li>
        )}
      </ul>
      {done && (
        <p className="sp-pop mt-2 rounded-lg bg-[#046c4e] px-2.5 py-1.5 text-[12px] font-semibold text-white">
          ✓ {t("No shop beats our price.")} {t("If one drops its price, we go")} {g.superPriceBeat ?? 3}% {t("below it after the next nightly check.")}
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
        className="sp-sticker flex items-center gap-1 whitespace-nowrap rounded-full border border-[#f3c4d2] bg-[#fdecef] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9b2c50] shadow-sm"
      >
        <span className="sp-spin inline-grid"><Mark /></span> SuperPrice {t("Guaranteed")}
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

/** Product page price: our normal price first, then the SuperPrice discount comes off it. */
export function SuperPriceTag({ was, price }: { was: number; price: number }) {
  const t = useT();
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const id = setTimeout(() => setOn(true), reduce ? 0 : 1100);
    return () => clearTimeout(id);
  }, [was, price]);
  const off = was - price;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-3">
      <span className={`pdp-price font-bold transition-all duration-500 ${on ? "text-lg text-muted line-through decoration-[#c0587a]" : "text-3xl"}`}>{money(was)}</span>
      {on ? (
        <>
          <span className="sp-pop pdp-price text-3xl font-bold text-[#9b2c50]">{money(price)}</span>
          <span className="sp-pop sp-shine inline-flex items-center gap-1 rounded-full bg-[#fdecef] px-2.5 py-1 text-sm font-bold text-[#9b2c50]"><Mark /> SuperPrice −{money(off)} · {fmtPct(off / was)}</span>
        </>
      ) : (
        <span className="flex items-center gap-2 text-xs text-muted"><span className="sp-scan relative h-1 w-14 overflow-hidden rounded-full bg-[#f3c4d2]" aria-hidden />{t("Checking other shops…")}</span>
      )}
    </span>
  );
}
