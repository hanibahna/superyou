"use client";

import { money } from "@/lib/format";
import { useGrowth, useT } from "@/lib/site-context";
import { useShop } from "@/lib/store";
import { isSubscribable } from "@/lib/subscribable";

/** Subscribe & save choice on the product page: one-time, monthly or every 3 months. */
export function SubscribeChoice({ price, value, onChange }: { price: number; value: 0 | 1 | 3; onChange: (v: 0 | 1 | 3) => void }) {
  const t = useT();
  const sub = useGrowth().subscribe;
  if (!sub?.enabled || (!sub.monthly && !sub.quarterly)) return null;
  const opts: [0 | 1 | 3, string, number][] = [[0, t("One-time purchase"), 0], ...(sub.monthly ? [[1, t("Every month"), sub.monthly] as [1, string, number]] : []), ...(sub.quarterly ? [[3, t("Every 3 months"), sub.quarterly] as [3, string, number]] : [])];
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-sm font-semibold">{t("Subscribe & save")}</legend>
      <div className="space-y-2">
        {opts.map(([k, label, pct]) => (
          <label key={k} className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-2.5 ${value === k ? "border-ink bg-[#faf7f8]" : "border-line"}`}>
            <input type="radio" name="sub-plan" checked={value === k} onChange={() => onChange(k)} className="h-4 w-4 accent-[var(--color-ink)]" />
            <span className="flex-1">
              <span className="font-semibold">{label}</span>
              {pct > 0 && <span className="ms-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">−{pct}%</span>}
            </span>
            <span className="text-sm font-semibold">{money(+(price * (1 - pct / 100)).toFixed(2))}</span>
          </label>
        ))}
      </div>
      {value !== 0 && sub.note && <p className="mt-2 text-xs text-muted">{t(sub.note)}</p>}
    </fieldset>
  );
}

/** Small plan switch on a bag line. */
export function LinePlan({ productId, every, readOnly = false, name }: { productId: string; every?: 1 | 3; readOnly?: boolean; name?: string }) {
  const t = useT();
  const sub = useGrowth().subscribe;
  const { setEvery } = useShop();
  if (!sub?.enabled || (name && !isSubscribable({ name }))) return null;
  const label = (e?: 1 | 3) => (e === 1 ? `${t("Every month")} · −${sub.monthly}%` : e === 3 ? `${t("Every 3 months")} · −${sub.quarterly}%` : t("One-time"));
  if (readOnly) return every ? <p className="mt-0.5 text-xs font-semibold text-brand-700">↻ {label(every)}</p> : null;
  return (
    <label className="mt-1 block text-xs">
      <span className="sr-only">{t("Delivery plan")}</span>
      <select value={every ?? 0} onChange={(e) => setEvery(productId, (Number(e.target.value) || undefined) as 1 | 3 | undefined)} className={`rounded-full border px-2 py-1 ${every ? "border-brand-500 font-semibold text-brand-700" : "border-line text-muted"}`}>
        <option value={0}>{label()}</option>
        {sub.monthly > 0 && <option value={1}>↻ {label(1)}</option>}
        {sub.quarterly > 0 && <option value={3}>↻ {label(3)}</option>}
      </select>
    </label>
  );
}
