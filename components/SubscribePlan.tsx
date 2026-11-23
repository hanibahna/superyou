"use client";

import { money } from "@/lib/format";
import { EVERY, everyLabel, everyOptions, tierOf, type Every } from "@/lib/every";
import { useGrowth, useT } from "@/lib/site-context";
import { useShop } from "@/lib/store";
import { isSubscribable } from "@/lib/subscribable";

type Life = { days: number; every: Every; basis: string } | null;
const weeks = (d: number) => (d < 45 ? `${Math.round(d / 7)} weeks` : `${Math.round(d / 30.4)} months`);

/** Subscribe & save choice on the product page: one-time, or delivery as often as this product runs out. */
export function SubscribeChoice({ price, value, onChange, life }: { price: number; value: 0 | Every; onChange: (v: 0 | Every) => void; life?: Life }) {
  const t = useT();
  const sub = useGrowth().subscribe;
  if (!sub?.enabled || (!sub.monthly && !sub.quarterly)) return null;
  const pctOf = (e: number) => (tierOf(e) === "monthly" ? sub.monthly : sub.quarterly);
  const needOf = (e: number) => (e === 1 ? sub.unlockMonthly ?? 3 : sub.unlockQuarterly ?? 2);
  const plans = (life ? everyOptions(life.every) : ([1, 3] as Every[])).filter((e) => pctOf(e) > 0);
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
      {value !== 0 && <p className="mt-2 text-xs text-muted">{t("Your first deliveries are full price. Once they're delivered, the rebate comes off your next delivery automatically.")} {sub.note ? t(sub.note) : ""} <a href="/pages/subscription-terms/" className="underline">{t("Terms")}</a></p>}
    </fieldset>
  );
}

/** Small plan switch on a bag line. */
export function LinePlan({ productId, every, readOnly = false, name }: { productId: string; every?: Every; readOnly?: boolean; name?: string }) {
  const t = useT();
  const sub = useGrowth().subscribe;
  const { setEvery } = useShop();
  // Lines added on a plan keep their choice; others offer the usual plans when the product can be subscribed.
  if (!sub?.enabled || (!every && name && !isSubscribable({ name }))) return null;
  const pctOf = (e: number) => (tierOf(e) === "monthly" ? sub.monthly : sub.quarterly);
  const label = (e?: Every) => (e ? `${t(everyLabel(e))} · ${t("earn")} ${pctOf(e)}%` : t("One-time"));
  if (readOnly) return every ? <p className="mt-0.5 text-xs font-semibold text-brand-700">↻ {label(every)}</p> : null;
  const opts = every ? [...new Set([every, ...EVERY])].sort((a, b) => a - b) : ([1, 3] as Every[]);
  return (
    <label className="mt-1 block text-xs">
      <span className="sr-only">{t("Delivery plan")}</span>
      <select value={every ?? 0} onChange={(e) => setEvery(productId, (Number(e.target.value) || undefined) as Every | undefined)} className={`rounded-full border px-2 py-1 ${every ? "border-brand-500 font-semibold text-brand-700" : "border-line text-muted"}`}>
        <option value={0}>{label()}</option>
        {opts.filter((e) => pctOf(e) > 0).map((e) => <option key={e} value={e}>↻ {label(e)}</option>)}
      </select>
    </label>
  );
}
