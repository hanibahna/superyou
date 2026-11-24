"use client";

// SuperPrime at checkout: members see their free delivery; others can start the free trial
// (first order from the trial minimum) or add a month to this order.
import { money } from "@/lib/format";
import { useGrowth, useT } from "@/lib/site-context";
import { useShop } from "@/lib/store";

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

export function SuperPrimeBadge({ className = "" }: { className?: string }) {
  const name = useGrowth().prime?.name ?? "SuperPrime";
  return <span className={`inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white ${className}`}><span className="text-[#e8b4c4]">✦</span>{name}</span>;
}

export function SuperPrimeBox() {
  const t = useT();
  const pr = useGrowth().prime;
  const { quote, primeChoice, setPrimeChoice, subtotal } = useShop();
  if (!pr?.enabled) return null;
  const q = quote?.prime;
  const after = subtotal - (quote?.discountTotal ?? 0);
  const member = q?.status === "trial" || q?.status === "active";
  if (member)
    return (
      <div className="sp-in rounded-2xl border border-ink bg-ink p-4 text-sm text-white">
        <SuperPrimeBadge className="bg-white !text-ink" />
        <p className="mt-2 font-semibold">{t("You're a member: free delivery on this order.")}</p>
        <p className="text-xs text-white/70">{q?.status === "trial" ? t("Free trial") : t("Member")} {t("until")} {fmt(q?.until)}.{pr.unlimitedSuperPrice ? ` ${t("SuperPrice on every order, no daily limit.")}` : ""}</p>
      </div>
    );
  const trialAvail = !q?.trialUsed && pr.trialMonths > 0;
  const needed = Math.max(0, pr.trialMinOrder - after);
  return (
    <div className="rounded-2xl border-2 border-ink p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <SuperPrimeBadge />
        <span className="text-xs text-muted">{money(pr.monthlyPrice)}/{t("month")}</span>
      </div>
      <p className="mt-2 font-semibold">{t("Free delivery on every order")}{pr.freeMin > 0 ? ` ${t("from")} ${money(pr.freeMin)}` : ""}{pr.unlimitedSuperPrice ? `, ${t("SuperPrice with no daily limit")}` : ""}.</p>
      {trialAvail && q?.trialOk && pr.promoLive && <p className="mt-2 inline-block rounded-full bg-[#c0587a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{t("Limited time: 3 months free, no minimum")}</p>}
      {trialAvail && q?.trialOk && (
        <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-[#fff5f8] p-3">
          <input type="checkbox" checked={primeChoice === "trial"} onChange={(e) => setPrimeChoice(e.target.checked ? "trial" : "")} className="mt-0.5" />
          <span><b>{t("Start")} {pr.trialMonths} {t("months free")}</b> {t("with this order. Nothing to pay later unless you choose to renew.")}</span>
        </label>
      )}
      {trialAvail && !q?.trialOk && !pr.promoLive && needed > 0 && (
        <p className="mt-2 rounded-lg bg-[#fff5f8] p-2 text-xs">{t("Add")} <b>{money(needed)}</b> {t("more to get")} <b>{pr.trialMonths} {t("months free")}</b> {t("(first order of")} {money(pr.trialMinOrder)}+).</p>
      )}
      <label className="mt-2 flex cursor-pointer items-start gap-2 p-1">
        <input type="checkbox" checked={primeChoice === "join"} onChange={(e) => setPrimeChoice(e.target.checked ? "join" : "")} className="mt-0.5" />
        <span>{q?.status === "lapsed" ? t("Renew for") : t("Join for")} <b>{money(pr.monthlyPrice)}</b> {t("and get free delivery on this order and every order for 30 days. Paid with this order; it never renews by itself.")}</span>
      </label>
      {!q?.known && <p className="mt-1 text-[11px] text-muted">{t("Already a member? Enter your mobile number above.")}</p>}
    </div>
  );
}

/** Bag and cart page: a short SuperPrime offer; the choice itself is made at checkout. */
export function SuperPrimeTeaser({ className = "" }: { className?: string }) {
  const t = useT();
  const pr = useGrowth().prime;
  const { quote, subtotal } = useShop();
  if (!pr?.enabled || quote?.prime?.status === "trial" || quote?.prime?.status === "active") return null;
  const after = subtotal - (quote?.discountTotal ?? 0);
  const free = pr.trialMonths > 0 && (pr.promoLive || after >= pr.trialMinOrder);
  return (
    <div className={`sp-in flex items-center gap-3 rounded-xl bg-ink px-3 py-2 text-xs text-white ${className}`}>
      <SuperPrimeBadge className="shrink-0 bg-white !text-ink" />
      <span>
        {t("Free delivery on every order.")}{" "}
        {free ? <b className="text-[#e8b4c4]">{pr.trialMonths} {t("months free")}</b> : <b>{money(pr.monthlyPrice)}/{t("month")}</b>}
        {!free && pr.trialMonths > 0 && <> {t("or")} {pr.trialMonths} {t("months free from")} {money(pr.trialMinOrder)}</>}. {t("Tick it at checkout.")}
      </span>
    </div>
  );
}
