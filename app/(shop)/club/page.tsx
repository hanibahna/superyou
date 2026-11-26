import { getT } from "@/lib/i18n-server";
import { notFound } from "next/navigation";
import { getGrowth } from "@/lib/growth-store";
import { JoinClub } from "./JoinClub";

export async function generateMetadata() {
  return { title: 'SuperYou Club', description: 'Join the SuperYou Club: earn points on every order, get rewards, a birthday gift and member prices on beauty and parapharmacy in Lebanon.', ...(await (await import("@/lib/seo")).canonical('/club/')) };
}

export default async function ClubPage() {
  const tx = await getT();
  const g = await getGrowth();
  if (!g.club.enabled) notFound();
  return (
    <div>
      <section className="bg-ink py-16 text-center text-white">
        <p className="text-xs uppercase tracking-[0.4em] text-white/60">{tx("Loyalty")}</p>
        <h1 className="mt-3 text-4xl font-black md:text-6xl">{g.club.name}</h1>
        <p className="mx-auto mt-4 max-w-xl text-white/70">
          Earn {g.club.pointsPerDollar} point per $1. Every {g.club.rewardPoints} points becomes a ${g.club.rewardValue} voucher, sent to you on WhatsApp.
          {g.club.birthdayPercent > 0 ? ` Plus ${g.club.birthdayPercent}% off on your birthday.` : ""}
        </p>
      </section>
      <section className="container-x grid gap-4 py-12 md:grid-cols-3">
        {g.club.tiers.map((t, i) => (
          <div key={t.name} className={`rounded-2xl border p-6 ${i === g.club.tiers.length - 1 ? "border-ink bg-ink text-white" : "border-line"}`}>
            <p className="text-xs uppercase tracking-[0.3em] opacity-60">{t.minSpend === 0 ? "Free to join" : `From $${t.minSpend} a year`}</p>
            <p className="mt-2 text-3xl font-black">{t.name}</p>
            <p className="mt-1 text-sm opacity-70">× {t.multiplier} points</p>
            <ul className="mt-4 space-y-1.5 text-sm">{t.perks.split("·").map((p) => <li key={p}>✓ {p.trim()}</li>)}</ul>
          </div>
        ))}
      </section>
      <section className="container-x pb-12">
        <h2 className="text-2xl font-bold">{tx("How to earn points")}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[
            [`${g.club.pointsPerDollar} pt / $1`, tx("Every delivered order")],
            g.club.bonus.join > 0 && [`+${g.club.bonus.join}`, tx("Joining the club")],
            g.club.bonus.firstOrder > 0 && [`+${g.club.bonus.firstOrder}`, tx("Your first order")],
            g.club.bonus.review > 0 && [`+${g.club.bonus.review} / +${g.club.bonus.photoReview}`, tx("A review / with a photo")],
            g.club.referral.enabled && [g.club.referral.referrerAmount ? `$${g.club.referral.referrerAmount}` : `+${g.club.referral.referrerPoints}`, tx("Each friend you refer")],
            g.club.birthdayPercent > 0 && [`${g.club.birthdayPercent}%`, tx("Off on your birthday")],
          ].filter((x): x is [string, string] => !!x).map(([a, b]) => (
            <div key={b} className="rounded-2xl bg-[#f5f5f5] p-4 text-center"><p className="text-2xl font-black">{a}</p><p className="mt-1 text-xs text-muted">{b}</p></div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          {tx("Every")} {g.club.rewardPoints} {tx("points becomes a")} ${g.club.rewardValue} {tx("voucher, sent on WhatsApp.")}
          {g.club.referral.enabled ? ` ${tx("Friends you invite get")} $${g.club.referral.friendAmount} ${tx("off their first order.")}` : ""}
          {g.club.memberPrice.enabled ? ` ${tx("Members also get")} ${g.club.memberPrice.percent}% ${tx("off selected products at checkout.")}` : ""}
          {g.club.expiryMonths ? ` ${tx("Points expire after")} ${g.club.expiryMonths} ${tx("months without an order.")}` : ""}
        </p>
      </section>
      <section className="container-x max-w-md pb-16"><JoinClub /></section>
    </div>
  );
}
