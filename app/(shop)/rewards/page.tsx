import Link from "next/link";
import { getGrowth } from "@/lib/growth-store";
import { primePromoLive } from "@/lib/growth";
import { getT } from "@/lib/i18n-server";
import { bfPublic } from "@/lib/bf-public";
import { PrimeLogo } from "@/components/PrimeLogo";

// One page that explains every reward in plain words: Club points, SuperPrime and (while it runs)
// Black Friday stamps. Numbers come live from Admin → Growth, so the page never promises more than the shop gives.
export async function generateMetadata() {
  return { title: "Your rewards – SuperYou", description: "How SuperYou rewards work: Club points and vouchers, SuperPrime free delivery, and seasonal stamps." };
}

export default async function RewardsPage() {
  const tx = await getT();
  const [g, bf] = await Promise.all([getGrowth(), bfPublic().catch(() => null)]);
  const c = g.club, p = g.prime;
  const stamps = bf && bf.fx.stamps && (bf.phase === "soon" || bf.phase === "live");
  const cards = [
    c.enabled && {
      key: "club",
      title: c.name,
      line: `${c.pointsPerDollar} ${tx("point per $1")} · ${c.rewardPoints} ${tx("points")} = $${c.rewardValue} ${tx("voucher")}`,
      points: [
        tx("Earn on every delivered order"),
        c.bonus.join > 0 ? `+${c.bonus.join} ${tx("points for joining")}` : "",
        c.bonus.review > 0 ? `+${c.bonus.review} ${tx("points for a review")}${c.bonus.photoReview > 0 ? ` (+${c.bonus.photoReview} ${tx("with a photo")})` : ""}` : "",
        c.birthdayPercent > 0 ? `${c.birthdayPercent}% ${tx("off on your birthday")}` : "",
        c.expiryMonths > 0 ? `${tx("Points stay valid while you order at least once every")} ${c.expiryMonths} ${tx("months")}` : "",
      ].filter(Boolean),
      cta: tx("Join free"), href: "/club/",
    },
    p.enabled && {
      key: "prime",
      title: p.name,
      line: `$${p.monthlyPrice.toFixed(2)}/${tx("month")}, ${tx("never renews by itself")}`,
      points: [
        `${tx("Free delivery on every order")}${p.freeMin > 0 ? ` ${tx("from")} $${p.freeMin}` : ""}`,
        p.unlimitedSuperPrice ? tx("SuperPrice with no daily limit") : "",
        p.trialMonths > 0 ? (primePromoLive(p) ? `${p.trialMonths} ${tx("months free right now, no minimum")}` : `${p.trialMonths} ${tx("months free with an order over")} $${p.trialMinOrder}`) : "",
      ].filter(Boolean),
      cta: tx("Add it at checkout"), href: "/cart/",
    },
    stamps && {
      key: "stamps",
      title: tx("Black Friday stamps"),
      line: tx("Only while Black Friday runs"),
      points: [`+${bf!.fx.stampPoints} ${tx("Club points for each day you order")}`, `+${bf!.fx.stampBonus} ${tx("bonus points when you collect every day")}`],
      cta: tx("Shop Black Friday"), href: "/shop/?bf=1",
    },
  ].filter(Boolean) as { key: string; title: string; line: string; points: string[]; cta: string; href: string }[];

  return (
    <div className="container-x max-w-5xl py-8 md:py-12">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600">{tx("Rewards")}</p>
      <h1 className="mt-1 text-3xl font-bold md:text-5xl">{tx("Your rewards, in one place")}</h1>
      <p className="mt-3 max-w-2xl text-muted">{tx("What you get for shopping with us, and how to use it. Points show on every product page before you buy.")}</p>
      <div className={`mt-8 grid gap-4 ${cards.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {cards.map((k) => (
          <section key={k.key} className={`flex flex-col rounded-3xl p-6 ${k.key === "prime" ? "bg-ink text-white" : "bg-[#f6f1f3]"}`}>
            {k.key === "prime" ? <PrimeLogo tone="light" className="h-7 w-auto self-start" /> : <h2 className="text-2xl font-bold">{k.title}</h2>}
            <p className={`mt-2 text-sm font-semibold ${k.key === "prime" ? "text-white/80" : "text-brand-700"}`}>{k.line}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">{k.points.map((x) => <li key={x} className="flex gap-2"><span aria-hidden>✓</span><span>{x}</span></li>)}</ul>
            <Link href={k.href} className={`tap mt-6 inline-flex items-center justify-center rounded-full px-5 text-sm font-semibold ${k.key === "prime" ? "bg-white text-ink" : "bg-ink text-white"}`}>{k.cta}</Link>
          </section>
        ))}
      </div>
      {c.enabled && c.tiers.length > 1 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">{tx("Club levels")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {c.tiers.map((t) => (
              <div key={t.name} className="rounded-2xl border border-line p-4">
                <p className="font-bold">{t.name} <span className="text-xs font-normal text-muted">{t.minSpend === 0 ? tx("free") : `${tx("from")} $${t.minSpend}/${tx("year")}`}</span></p>
                <p className="mt-1 text-sm text-muted">{t.perks}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="mt-8 text-sm text-muted">{tx("Check your points and vouchers in")} <Link href="/account/" className="font-semibold text-ink underline">{tx("your account")}</Link>.</p>
    </div>
  );
}
