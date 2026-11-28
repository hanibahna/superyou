import Link from "next/link";
import { PricingTabs } from "@/components/admin/PricingTabs";
import { discountStatus } from "@/lib/discount-status";

export const dynamic = "force-dynamic";

const STATE: Record<string, string> = { Live: "bg-emerald-50 text-emerald-700", Scheduled: "bg-amber-50 text-amber-800", Paused: "bg-amber-50 text-amber-800", Off: "bg-black/5 text-muted", Ended: "bg-black/5 text-muted", "Used up": "bg-black/5 text-muted" };

export default async function DiscountStatusPage() {
  const s = await discountStatus();
  const order = ["Live", "Paused", "Scheduled", "Used up", "Ended", "Off"];
  const rules = [...s.rules].sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || b.warnings.length - a.warnings.length);
  const issues = rules.filter((r) => r.warnings.length && (r.state === "Live" || r.state === "Scheduled" || r.state === "Paused")).length;
  return (
    <div>
      <PricingTabs />
      <h1 className="text-2xl font-bold">Discount status</h1>
      <p className="mb-5 text-sm text-muted">Every sale, Black Friday price, min-spend discount and promo code: what it covers, what it excludes, where it really applies, and anything that looks wrong. Change rules in <Link className="underline" href="/admin/promotions/">Discounts & codes</Link> and <Link className="underline" href="/admin/black-friday/">Black Friday</Link>.</p>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Box label="All discounts & codes" value={s.paused ? "OFF" : "ON"} tone={s.paused ? "warn" : "ok"} href="/admin/promotions/" />
        <Box label="Rules live now" value={String(rules.filter((r) => r.state === "Live").length)} href="#rules" />
        <Box label="Products on sale" value={`${s.onSale.toLocaleString()} / ${s.products.toLocaleString()}`} href="#rules" />
        <Box label="Capped by the minimum margin" value={s.cappedTotal.toLocaleString()} tone={s.cappedTotal ? "warn" : undefined} href="/admin/margins/" />
        <Box label="Rules to check" value={String(issues)} tone={issues ? "warn" : "ok"} href="#rules" />
      </div>

      <section className="mb-5 rounded-xl bg-white p-5 text-sm shadow-sm">
        <h2 className="mb-2 font-semibold">How the rules combine</h2>
        <ul className="list-disc space-y-1 ps-5 text-muted">
          <li>Automatic sales and Black Friday: a product gets the single biggest one that covers it, never two.</li>
          <li>Exceptions remove products from a rule (one type per rule: brands, categories, concerns, badges or products).</li>
          <li>Min-spend discounts and codes come off at checkout. A code marked "doesn't add to sale prices" skips products already on sale.</li>
          <li>Everything together stops at the minimum margin ({s.floorPct}% store-wide, or the brand's own), item by item. SuperPrice items never take a code.</li>
          <li>Personal codes (welcome, Club rewards, birthdays, influencers) keep working when the master switch is off.</li>
          {s.regrouped > 0 && <li>{s.regrouped.toLocaleString()} products were regrouped into Baby & Mom or Supplements; category rules still match them by their original category too.</li>}
        </ul>
      </section>

      <section id="rules" className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Rules</h2>
        {rules.length === 0 ? <p className="text-sm text-muted">No discount rules yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="py-2 pr-3">Rule</th><th className="pr-3">Status</th><th className="pr-3">Off</th><th className="pr-3">Applies to</th><th className="pr-3">Exceptions</th><th className="pr-3">Covers</th><th className="pr-3">Used on</th><th>Check</th></tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="py-2 pr-3"><b>{r.name}</b><div className="text-xs text-muted">{r.kind}</div></td>
                    <td className="pr-3 pt-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATE[r.state]}`}>{r.state}</span></td>
                    <td className="pr-3 pt-2">{r.value}</td>
                    <td className="pr-3 pt-2">{r.scope}</td>
                    <td className="pr-3 pt-2">{r.exceptions}</td>
                    <td className="pr-3 pt-2">{r.covers.toLocaleString()}</td>
                    <td className="pr-3 pt-2">{r.kind === "Automatic sale" || r.kind === "Black Friday" ? r.wins.toLocaleString() : "at checkout"}</td>
                    <td className="pt-2">{r.warnings.length ? <ul className="space-y-0.5 text-xs text-amber-800">{r.warnings.map((w) => <li key={w}>• {w}</li>)}</ul> : <span className="text-xs text-emerald-700">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Box({ label, value, tone, href }: { label: string; value: string; tone?: "ok" | "warn"; href: string }) {
  return (
    <Link href={href} className="rounded-xl bg-white p-4 shadow-sm hover:shadow">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-bold ${tone === "warn" ? "text-amber-700" : tone === "ok" ? "text-emerald-700" : ""}`}>{value}</p>
    </Link>
  );
}
