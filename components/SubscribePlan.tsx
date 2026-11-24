"use client";

import { money } from "@/lib/format";
import { EVERY, everyLabel, everyOptions, monthsFrom, tierOf, type Every } from "@/lib/every";
import { useGrowth, useT } from "@/lib/site-context";
import { useShop } from "@/lib/store";
import { isSubscribable } from "@/lib/subscribable";

type Life = { days: number; every: Every; basis: string } | null;
const weeks = (d: number) => (d < 45 ? `${Math.round(d / 7)} weeks` : `${Math.round(d / 30.4)} months`);

/** Subscribe & save choice on the product page: one-time, or delivery as often as this product runs out. */
export function SubscribeChoice({ price, value, onChange, life, start, onStart }: { price: number; value: 0 | Every; onChange: (v: 0 | Every) => void; life?: Life; start?: string; onStart?: (d: string) => void }) {
  const t = useT();
  const sub = useGrowth().subscribe;
  if (!sub?.enabled || (!sub.monthly && !sub.quarterly)) return null;
  const pctOf = (e: number) => (tierOf(e) === "monthly" ? sub.monthly : sub.quarterly);
  const needOf = (e: number) => (e === 1 ? sub.unlockMonthly ?? 3 : sub.unlockQuarterly ?? 2);
  const base = life ? everyOptions(life.every) : ([1, 3] as Every[]);
  const plans = [...new Set([...base, ...(value && !base.includes(value) ? [value] : [])])].filter((e) => pctOf(e) > 0);
  if (!plans.length) return null;
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-sm font-semibold">{t("Subscribe & save")}</legend>
      {life && <p className="-mt-1 mb-2 text-xs text-muted">{t("Lasts about")} {t(weeks(life.days))}{life.basis ? ` (${life.basis})` : ""}</p>}
      <div className="space-y-2">
        {([0, ...plans] as (0 | Every)[]).map((k) => (
          <label key={k} className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-2.5 ${value === k ? "border-ink bg-[#faf7f8]" : "border-line"}`}>
            <input type="radio" name="sub-plan" checked={value === k} onChange={() => onChange(k)} className="h-4 w-4 accent-[var(--color-ink)]" />
            <span className="flex-1">
              <span className="font-semibold">{k ? t(everyLabel(k)) : t("One-time purchase")}</span>
              {k !== 0 && life && k === life.every && <span className="ms-2 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-800">{t("recommended")}</span>}
              {k !== 0 && <span className="ms-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">{t("earn")} {pctOf(k)}%</span>}
              {k !== 0 && <span className="block text-xs text-muted">{t("After")} {needOf(k)} {t("deliveries")}: {pctOf(k)}% {t("back on them, then")} {pctOf(k)}% {t("off every order")}</span>}
            </span>
            <span className="text-sm font-semibold">{money(price)}</span>
          </label>
        ))}
      </div>
      {value !== 0 && <PlanDates every={value} start={start} onEvery={onChange} onStart={onStart} pctOf={pctOf} />}
      {value !== 0 && <p className="mt-2 text-xs text-muted">{t("Your first deliveries are full price. Once they're delivered, the rebate comes off your next delivery automatically.")} {sub.note ? t(sub.note) : ""} <a href="/pages/subscription-terms/" className="underline">{t("Terms")}</a></p>}
    </fieldset>
  );
}

/** Small plan switch on a bag line. */
export function LinePlan({ productId, every, start, readOnly = false, name }: { productId: string; every?: Every; start?: string; readOnly?: boolean; name?: string }) {
  const t = useT();
  const sub = useGrowth().subscribe;
  const { setEvery } = useShop();
  // Lines added on a plan keep their choice; others offer the usual plans when the product can be subscribed.
  if (!sub?.enabled || (!every && name && !isSubscribable({ name }))) return null;
  const pctOf = (e: number) => (tierOf(e) === "monthly" ? sub.monthly : sub.quarterly);
  const label = (e?: Every) => (e ? `${t(everyLabel(e))} · ${t("earn")} ${pctOf(e)}%` : t("One-time"));
  const nextTxt = every ? `${t("next")} ${new Date(`${start ?? monthsFrom(every)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "";
  if (readOnly) return every ? <p className="mt-0.5 text-xs font-semibold text-brand-700">↻ {label(every)} · {nextTxt}</p> : null;
  const opts = every ? [...EVERY] : ([1, 3] as Every[]);
  return (
    <label className="mt-1 block text-xs">
      <span className="sr-only">{t("Delivery plan")}</span>
      <select value={every ?? 0} onChange={(e) => { const n = Number(e.target.value) || undefined; setEvery(productId, n as Every | undefined, n ? monthsFrom(n) : undefined); }} className={`rounded-full border px-2 py-1 ${every ? "border-brand-500 font-semibold text-brand-700" : "border-line text-muted"}`}>
        <option value={0}>{label()}</option>
        {opts.filter((e) => pctOf(e) > 0).map((e) => <option key={e} value={e}>↻ {label(e)}</option>)}
      </select>
      {every && (
        <input type="date" aria-label={t("Next delivery on")} value={start ?? monthsFrom(every)} min={monthsFrom(0, new Date(Date.now() + 864e5))} max={monthsFrom(13)} onChange={(e) => e.target.value && setEvery(productId, every, e.target.value)} className="ms-2 rounded-full border border-brand-500 px-2 py-0.5 text-brand-700" />
      )}
    </label>
  );
}

const prettyDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

/** Months apart (1 to 12) and the date of the next delivery, picked on a calendar. The first
 *  delivery is this order; the next ones follow every N months from the date picked. */
export function PlanDates({ every, start, onEvery, onStart, pctOf }: { every: Every; start?: string; onEvery: (e: Every) => void; onStart?: (d: string) => void; pctOf: (e: number) => number }) {
  const t = useT();
  const next = start ?? monthsFrom(every);
  const after = [1, 2].map((k) => monthsFromDate(next, every * k));
  return (
    <div className="mt-3 rounded-2xl border border-line bg-white p-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-muted">{t("Deliver every")}</span>
          <select value={every} onChange={(e) => { const n = Number(e.target.value) as Every; onEvery(n); onStart?.(monthsFrom(n)); }} className="mt-1 min-h-[44px] w-full rounded-xl border border-line px-2">
            {EVERY.filter((e) => pctOf(e) > 0).map((e) => <option key={e} value={e}>{e === 1 ? t("1 month") : `${e} ${t("months")}`}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted">{t("Next delivery on")}</span>
          <input type="date" value={next} min={monthsFrom(0, new Date(Date.now() + 864e5))} max={monthsFrom(13)} onChange={(e) => e.target.value && onStart?.(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-xl border border-line px-2" />
        </label>
      </div>
      <p className="mt-2 text-xs text-muted">
        {t("Today's order, then")} <b className="text-ink">{prettyDay(next)}</b>, {after.map(prettyDay).join(", ")}… {t("Change, skip or pause any time.")}
      </p>
    </div>
  );
}

function monthsFromDate(d: string, n: number) {
  const [y, m, day] = d.split("-").map(Number);
  return monthsFrom(n, new Date(y, m - 1, day));
}
