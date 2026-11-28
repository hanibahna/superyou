"use client";

import { money } from "@/lib/format";
import { EVERY, everyLabel, MAX_MONTHS, monthsFrom, OFFERED, subPct, type Every } from "@/lib/every";
import { useGrowth, useT } from "@/lib/site-context";
import { useShop } from "@/lib/store";
import { isSubscribable } from "@/lib/subscribable";

type Life = { days: number; every: Every; basis: string } | null;
const weeks = (d: number) => (d < 45 ? `${Math.round(d / 7)} weeks` : `${Math.round(d / 30.4)} months`);

/** Subscribe & save on the product page: one-time, or "Deliver every 1 / 2 / 3 / 4 / 6 months" with the
 *  product's most common frequency marked, the same discount whichever is picked, and the saving a year. */
export function SubscribeChoice({ price, value, onChange, life, start, onStart, forMonths, onFor, brandPct }: { price: number; value: 0 | Every; onChange: (v: 0 | Every) => void; life?: Life; start?: string; onStart?: (d: string) => void; forMonths?: number; onFor?: (n: number) => void; brandPct?: number }) {
  const t = useT();
  const sub = useGrowth().subscribe;
  if (!sub?.enabled) return null;
  const pct = brandPct ?? subPct(sub); // a brand can have its own % (Admin → Margins)
  if (!pct) return null;
  const fast = !!(sub as { promoLive?: boolean }).promoLive;
  const promo = fast ? sub.promo : undefined;
  const needOf = (e: number) => (e === 1 ? sub.unlockMonthly ?? 3 : sub.unlockQuarterly ?? 2);
  const common: Every = life ? (OFFERED.includes(life.every) ? life.every : OFFERED.reduce((a, b) => (Math.abs(b - life.every) < Math.abs(a - life.every) ? b : a))) : 3;
  const chosen = (value || common) as Every;
  const opts = [...new Set([...OFFERED, ...(value && !OFFERED.includes(value) ? [value] : [])])].sort((a, b) => a - b) as Every[];
  const yearly = +((price * pct) / 100 * (12 / chosen)).toFixed(2);
  const card = (on: boolean) => `flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-2.5 text-start ${on ? "border-ink bg-[#faf7f8]" : "border-line"}`;
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-sm font-semibold">{t("Subscribe & save")}</legend>
      <div className="space-y-2">
        <label className={card(value === 0)}>
          <input type="radio" name="sub-plan" checked={value === 0} onChange={() => onChange(0)} className="h-4 w-4 accent-[var(--color-ink)]" />
          <span className="flex-1 font-semibold">{t("One-time purchase")}</span>
          <span className="text-sm font-semibold">{money(price)}</span>
        </label>
        <div className={card(value !== 0) + " flex-col items-stretch"}>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="radio" name="sub-plan" checked={value !== 0} onChange={() => onChange(common)} className="h-4 w-4 accent-[var(--color-ink)]" />
            <span className="flex-1">
              <span className="font-semibold">{t("Auto-replenish")}</span>
              <span className="ms-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">{pct}% {t("off")}</span>
            </span>
            {/* What is charged today: the campaign's first-order % if one is live, otherwise full price (the % is earned). */}
            {fast && promo?.firstPct ? (
              <span className="text-end text-sm font-semibold"><span className="text-[#b42318]">{money(price * (1 - promo.firstPct / 100))}</span> <s className="text-xs font-normal text-muted">{money(price)}</s><span className="block text-[11px] font-normal text-muted">{t("today, then")} {money(price * (1 - pct / 100))}</span></span>
            ) : (
              <span className="text-end text-sm font-semibold">{money(price)}<span className="block text-[11px] font-normal text-muted">{t("then")} {money(price * (1 - pct / 100))}</span></span>
            )}
          </label>
          {value !== 0 && (
            <div className="mt-3 ps-7">
              <p className="text-sm">{t("Deliver every")}: <b>{chosen === 1 ? t("1 month") : `${chosen} ${t("months")}`}{chosen === common ? ` (${t("most common")})` : ""}</b></p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t("Deliver every")}>
                {opts.map((e) => (
                  <button key={e} type="button" role="radio" aria-checked={value === e} onClick={() => { onChange(e); onStart?.(monthsFrom(e)); if ((forMonths ?? MAX_MONTHS) < e) onFor?.(e); }}
                    className={`min-h-[44px] rounded-lg border-2 px-3.5 text-sm font-semibold ${value === e ? "border-ink bg-white" : "border-line bg-white/70 text-muted"}`}>
                    {e}{e === common ? ` (${t("most common")})` : ""}
                  </button>
                ))}
                <span className="self-center text-sm text-muted">{t("month(s)")}</span>
              </div>
              {life && <p className="mt-1.5 text-xs text-muted">{t("Lasts about")} {t(weeks(life.days))}{life.basis ? ` (${life.basis})` : ""}</p>}
              <p className="mt-3 rounded-xl bg-[#f6f1f3] px-3 py-2 text-sm">{t("You will save")} <b>{money(yearly)}</b> {t("a year with this subscription.")}</p>
              <p className="mt-2 text-xs text-muted">{fast ? `${promo?.firstPct ? `${promo.firstPct}% ${t("off today")}, ` : ""}${pct}% ${t("off every delivery after")}${promo?.freeDelivery ? `, ${t("delivery always free")}` : ""}.` : `${t("After")} ${needOf(chosen)} ${t("deliveries")}: ${pct}% ${t("back on them, then")} ${pct}% ${t("off every order")}.`}</p>
            </div>
          )}
        </div>
      </div>
      {value !== 0 && <PlanDates every={value} start={start} onEvery={onChange} onStart={onStart} forMonths={forMonths} onFor={onFor} pctOf={() => pct} hideEvery />}
      {value !== 0 && <p className="mt-2 text-xs text-muted">{fast ? "" : t("Your first deliveries are full price. Once they're delivered, the rebate comes off your next delivery automatically.")} {sub.note ? t(sub.note) : ""} <a href="/pages/subscription-terms/" className="underline">{t("Terms")}</a></p>}
    </fieldset>
  );
}

/** Small plan switch on a bag line. */
export function LinePlan({ productId, every, start, forMonths, readOnly = false, name }: { productId: string; every?: Every; start?: string; forMonths?: number; readOnly?: boolean; name?: string }) {
  const t = useT();
  const sub = useGrowth().subscribe;
  const { setEvery } = useShop();
  // Lines added on a plan keep their choice; others offer the usual plans when the product can be subscribed.
  if (!sub?.enabled || (!every && name && !isSubscribable({ name }))) return null;
  const pctOf = (_e?: number) => subPct(sub);
  const label = (e?: Every) => (e ? `${t(everyLabel(e))} · ${t("earn")} ${pctOf(e)}%` : t("One-time"));
  const nextTxt = every ? `${t("next")} ${new Date(`${start ?? monthsFrom(every)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "";
  const forTxt = every ? ` · ${t("for")} ${Math.max(every, forMonths ?? MAX_MONTHS)} ${t("months")}` : "";
  if (readOnly) return every ? <p className="mt-0.5 text-xs font-semibold text-brand-700">↻ {label(every)} · {nextTxt}{forTxt}</p> : null;
  const opts = every && !OFFERED.includes(every) ? [...OFFERED, every].sort((a, b) => a - b) : OFFERED;
  return (
    <label className="mt-1 block text-xs">
      <span className="sr-only">{t("Delivery plan")}</span>
      <select value={every ?? 0} onChange={(e) => { const n = Number(e.target.value) || undefined; setEvery(productId, n as Every | undefined, n ? monthsFrom(n) : undefined); }} className={`rounded-full border px-2 py-1 ${every ? "border-brand-500 font-semibold text-brand-700" : "border-line text-muted"}`}>
        <option value={0}>{label()}</option>
        {opts.filter(() => pctOf() > 0).map((e: Every) => <option key={e} value={e}>↻ {label(e)}</option>)}
      </select>
      {every && (
        <input type="date" aria-label={t("Next delivery on")} value={start ?? monthsFrom(every)} min={monthsFrom(0, new Date(Date.now() + 864e5))} max={monthsFrom(every)} onChange={(e) => e.target.value && setEvery(productId, every, e.target.value)} className="ms-2 rounded-full border border-brand-500 px-2 py-0.5 text-brand-700" />
      )}
      {every && (
        <select aria-label={t("For")} value={Math.max(every, forMonths ?? MAX_MONTHS)} onChange={(e) => setEvery(productId, every, start, Number(e.target.value))} className="ms-2 rounded-full border border-brand-500 px-2 py-1 text-brand-700">
          {Array.from({ length: MAX_MONTHS }, (_, i) => i + 1).filter((n) => n >= every).map((n) => <option key={n} value={n}>{t("for")} {n} {n === 1 ? t("month") : t("months")}</option>)}
        </select>
      )}
    </label>
  );
}

const prettyDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

/** How often (every 1-6 months), for how long (up to 6 months) and the date of the next delivery,
 *  picked on a calendar. The first delivery is this order; the next ones follow every N months
 *  from the date picked, until the plan's last month. */
export function PlanDates({ every, start, onEvery, onStart, forMonths, onFor, pctOf, hideEvery = false }: { every: Every; start?: string; onEvery: (e: Every) => void; onStart?: (d: string) => void; forMonths?: number; onFor?: (n: number) => void; pctOf: (e: number) => number; hideEvery?: boolean }) {
  const t = useT();
  const months = Math.max(every, Math.min(MAX_MONTHS, forMonths ?? MAX_MONTHS));
  const next = start ?? monthsFrom(every);
  const end = monthsFrom(months);
  const dates: string[] = [];
  for (let k = 0; k < 12; k++) {
    const d = monthsFromDate(next, every * k);
    if (d > end) break;
    dates.push(d);
  }
  return (
    <div className="mt-3 rounded-2xl border border-line bg-white p-3 text-sm">
      <div className={`grid gap-3 ${hideEvery ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {!hideEvery && <label className="block">
          <span className="text-xs font-semibold text-muted">{t("Deliver every")}</span>
          <select value={every} onChange={(e) => { const n = Number(e.target.value) as Every; onEvery(n); onStart?.(monthsFrom(n)); if (months < n) onFor?.(n); }} className="mt-1 min-h-[44px] w-full rounded-xl border border-line px-2">
            {EVERY.filter((e) => pctOf(e) > 0).map((e) => <option key={e} value={e}>{e === 1 ? t("1 month") : `${e} ${t("months")}`}</option>)}
          </select>
        </label>}
        <label className="block">
          <span className="text-xs font-semibold text-muted">{t("For")}</span>
          <select value={months} onChange={(e) => onFor?.(Number(e.target.value))} className="mt-1 min-h-[44px] w-full rounded-xl border border-line px-2">
            {Array.from({ length: MAX_MONTHS }, (_, i) => i + 1).filter((n) => n >= every).map((n) => <option key={n} value={n}>{n === 1 ? t("1 month") : `${n} ${t("months")}`}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted">{t("Next delivery on")}</span>
          <input type="date" value={next} min={monthsFrom(0, new Date(Date.now() + 864e5))} max={monthsFrom(Math.min(every, months))} onChange={(e) => e.target.value && onStart?.(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-xl border border-line px-2" />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted">
        {t("Today's order")}{dates.length ? <>, {t("then")} {dates.map((d, i) => <span key={d}>{i ? ", " : ""}{i === 0 ? <b className="text-ink">{prettyDay(d)}</b> : prettyDay(d)}</span>)}</> : null}. {1 + dates.length} {t("deliveries in")} {months} {months === 1 ? t("month") : t("months")}. {t("Change, skip or pause any time.")}
      </p>
    </div>
  );
}

function monthsFromDate(d: string, n: number) {
  const [y, m, day] = d.split("-").map(Number);
  return monthsFrom(n, new Date(y, m - 1, day));
}
