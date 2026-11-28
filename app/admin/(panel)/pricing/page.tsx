import Link from "next/link";
import { PricingTabs } from "@/components/admin/PricingTabs";
import { roomRows } from "@/lib/pricing-room";
import { getReport } from "@/lib/price-match";
import { getMargins } from "@/lib/margins";

export const dynamic = "force-dynamic";

const pill = (cls: string, t: string) => <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{t}</span>;
const OK = "bg-emerald-50 text-emerald-700", WARN = "bg-amber-50 text-amber-800", MUTED = "bg-black/5 text-muted";

function cell(v: number, room: number | null) {
  if (!v) return <span className="text-muted">–</span>;
  if (room == null) return <span>{v}%</span>;
  return v <= room ? <span>{v}% {pill(OK, "fits")}</span> : <span>{v}% {pill(WARN, `customers get ${room}%`)}</span>;
}

export default async function PricingOverview() {
  const [{ rows, codes, otherSales }, { report, running }, m] = await Promise.all([roomRows(), getReport(), getMargins()]);
  const live = rows.filter((r) => r.inStock > 0);
  const capped = live.filter((r) => r.room != null && Math.max(r.sale, r.bf, r.sub) > r.room);
  const noCost = live.filter((r) => r.room == null);
  const at = report?.at ? new Date(report.at).toLocaleString("en-GB", { timeZone: "Asia/Beirut", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div>
      <PricingTabs />
      <h1 className="text-2xl font-bold">Pricing overview</h1>
      <p className="mb-5 text-sm text-muted">Everything that sets what a product sells for, in one place. Every discount (sales, Black Friday, auto-replenish, codes) stops at the minimum margin, product by product. The room shown is the most a brand can take off on average.</p>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Minimum margin (store-wide)" value={`${m.floorPct}%`} href="/admin/margins/" />
        <Stat label="Brands where a discount is capped" value={String(capped.length)} warn={capped.length > 0} href="#brands" />
        <Stat label="Brands with no cost on file" value={String(noCost.length)} href="/admin/margins/" />
        <Stat label="On SuperPrice now" value={report ? String(report.matchedNow) : "–"} sub={running ? "price check running…" : at ? `checked ${at}` : "not checked yet"} href="/admin/superprice/" />
      </div>

      <section id="brands" className="mb-5 rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Margin room by brand</h2>
          <span className="text-xs text-muted">Change floors and auto-replenish in <Link className="underline" href="/admin/margins/">Margins & costs</Link>, sales in <Link className="underline" href="/admin/promotions/">Discounts & codes</Link>, Black Friday % in <Link className="underline" href="/admin/black-friday/">Black Friday</Link>.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr><th className="py-2 pr-3">Brand</th><th className="pr-3">In stock</th><th className="pr-3">Margin now</th><th className="pr-3">Floor</th><th className="pr-3">Room</th><th className="pr-3">Live sale</th><th className="pr-3">Black Friday</th><th>Auto-replenish</th></tr>
            </thead>
            <tbody>
              {live.map((r) => (
                <tr key={r.brand} className="border-t border-line">
                  <td className="py-2 pr-3 font-medium">{r.brand}</td>
                  <td className="pr-3">{r.inStock}</td>
                  <td className="pr-3">{r.marginPct == null ? <span className="text-muted">–</span> : `${r.marginPct}%`}</td>
                  <td className="pr-3">{r.floorPct}%</td>
                  <td className="pr-3">{r.room == null ? pill(MUTED, "no cost on file") : <b>{r.room}%</b>}</td>
                  <td className="pr-3">{cell(r.sale, r.room)}</td>
                  <td className="pr-3">{cell(r.bf, r.room)}</td>
                  <td>{cell(r.sub, r.room)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Promo codes</h2>
          <p className="mb-3 text-xs text-muted">Codes are capped item by item at checkout, so a code never takes an item under its minimum margin. SuperPrice items never take a code on top.</p>
          {codes.length ? (
            <ul className="space-y-1 text-sm">
              {codes.map((d) => <li key={d.id} className="flex justify-between gap-3 border-t border-line pt-1"><span><b>{d.code}</b> · {d.type === "percent" ? `${d.value}% off` : `$${d.value} off each`}</span>{pill(d.enabled ? OK : MUTED, d.enabled ? "on" : "off")}</li>)}
            </ul>
          ) : <p className="text-sm text-muted">No codes yet.</p>}
          {otherSales.length > 0 && <p className="mt-3 text-xs text-muted">Also running: {otherSales.map((d) => d.name).join(", ")} (by category, concern, tag or product, so not in the brand table; capped the same way).</p>}
        </section>
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">SuperPrice</h2>
          <p className="mb-3 text-xs text-muted">When another shop is cheaper, we go below them, never under cost plus the minimum margin.</p>
          {report ? (
            <ul className="space-y-1 text-sm">
              <li>Products found at other shops: <b>{report.matched.toLocaleString()}</b></li>
              <li>Cheaper somewhere else at the last check: <b>{report.cheaper.toLocaleString()}</b></li>
              <li>On SuperPrice now: <b>{report.matchedNow.toLocaleString()}</b></li>
            </ul>
          ) : <p className="text-sm text-muted">No price check yet.</p>}
          <Link href="/admin/superprice/" className="mt-3 inline-block text-sm font-semibold text-brand-600">Settings, check now and comparison email →</Link>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, warn, href }: { label: string; value: string; sub?: string; warn?: boolean; href: string }) {
  return (
    <Link href={href} className="rounded-xl bg-white p-4 shadow-sm hover:shadow">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-bold ${warn ? "text-amber-700" : ""}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </Link>
  );
}
