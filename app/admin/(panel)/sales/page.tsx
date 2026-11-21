import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { money } from "@/lib/format";
import { statusLabels, type OrderStatus } from "@/lib/orders";
import { salesReport } from "@/lib/sales";

const RANGES = [[7, "7 days"], [30, "30 days"], [90, "90 days"], [365, "12 months"]] as const;
const PAY: Record<string, string> = { cod: "Cash on delivery", card: "Card", whish: "Whish" };

function Change({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-xs text-muted">—</span>;
  const pct = ((now - before) / before) * 100;
  return <span className={`text-xs font-semibold ${pct >= 0 ? "text-brand-600" : "text-sale"}`}>{pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}% vs previous</span>;
}

function Bars({ rows, label }: { rows: { key: string; value: number; orders: number }[]; label: (k: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex justify-between gap-2"><span className="truncate">{label(r.key)}</span><span className="shrink-0 font-medium">{money(r.value)} <span className="text-xs font-normal text-muted">· {r.orders}</span></span></div>
          <div className="mt-1 h-1.5 rounded bg-[#eef0ee]"><div className="h-1.5 rounded bg-brand-500" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
      {!rows.length && <li className="text-muted">No sales yet.</li>}
    </ul>
  );
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin("sales");
  const days = Number((await searchParams).days) || 30;
  const r = await salesReport(days);
  const n = r.now, b = r.before;
  const maxDay = Math.max(1, ...r.daily.map((d) => d.net));
  const kpis = [
    { label: "Net sales", value: money(n.net), now: n.net, before: b.net, sub: "after discounts and refunds, incl. delivery" },
    { label: "Orders", value: String(n.orders), now: n.orders, before: b.orders, sub: `${n.units} items sold` },
    { label: "Average order", value: money(n.aov), now: n.aov, before: b.aov, sub: "net sales ÷ orders" },
    { label: "Customers", value: String(r.customers.total), now: r.customers.total, before: 0, sub: `${r.customers.new} new · ${r.customers.returning} returning` },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {RANGES.map(([d, l]) => <Link key={d} href={`/admin/sales/?days=${d}`} className={`rounded-full px-4 py-1.5 ${d === days ? "bg-ink text-white" : "bg-white"}`}>{l}</Link>)}
          <a href={`/api/admin/sales/export/?days=${days}`} className="rounded-full border border-line bg-white px-4 py-1.5 font-semibold">Download orders (CSV)</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-xs text-muted">{k.label}</p>
            <p className="mt-1 text-2xl font-bold">{k.value}</p>
            <p className="text-xs text-muted">{k.sub}</p>
            {k.before > 0 && <Change now={k.now} before={k.before} />}
          </div>
        ))}
      </div>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Net sales by day</h2>
        <div className="mt-4 flex h-40 items-end gap-[2px]" role="img" aria-label="Daily net sales">
          {r.daily.map((d) => (
            <div key={d.day} className="group relative flex-1" title={`${d.day}: ${money(d.net)} · ${d.orders} orders`}>
              <div className="rounded-t bg-brand-500/80 group-hover:bg-brand-600" style={{ height: `${Math.max(d.net ? 3 : 1, (d.net / maxDay) * 150)}px` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-muted"><span>{r.daily[0]?.day}</span><span>{r.daily.at(-1)?.day}</span></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl bg-white p-5 text-sm shadow-sm">
          <h2 className="mb-3 font-semibold">Breakdown</h2>
          <dl className="space-y-1.5">
            <div className="flex justify-between"><dt>Products sold (before discounts)</dt><dd>{money(n.gross)}</dd></div>
            <div className="flex justify-between text-brand-700"><dt>Discounts</dt><dd>−{money(n.discounts)}</dd></div>
            <div className="flex justify-between"><dt>Delivery charged</dt><dd>{money(n.delivery)}</dd></div>
            <div className="flex justify-between text-sale"><dt>Refunds</dt><dd>−{money(n.refunds)}</dd></div>
            <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><dt>Net sales</dt><dd>{money(n.net)}</dd></div>
            {r.giftCardsUsed > 0 && <p className="pt-1 text-xs text-muted">Includes {money(r.giftCardsUsed)} paid with gift cards.</p>}
          </dl>
        </section>
        <section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold">By payment</h2><Bars rows={r.byPayment} label={(k) => PAY[k] ?? k} /></section>
        <section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold">By area</h2><Bars rows={r.byArea} label={(k) => k} /></section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="overflow-x-auto rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">Best-selling products</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="pb-2">Product</th><th className="pb-2 text-right">Sold</th><th className="pb-2 text-right">Sales</th></tr></thead>
            <tbody className="divide-y divide-line">
              {r.topProducts.map((p) => (
                <tr key={p.productId}><td className="py-2"><Link href={`/admin/products/${p.productId}/`} className="hover:underline"><span className="text-muted">{p.brand}</span> {p.name}</Link></td><td className="py-2 text-right">{p.units}</td><td className="py-2 text-right font-medium">{money(p.value)}</td></tr>
              ))}
              {!r.topProducts.length && <tr><td colSpan={3} className="py-6 text-center text-muted">No sales in this period.</td></tr>}
            </tbody>
          </table>
        </section>
        <div className="space-y-6">
          <section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold">Top brands</h2><Bars rows={r.topBrands.map((b) => ({ key: b.brand, value: b.value, orders: b.units }))} label={(k) => k} /></section>
          <section className="rounded-xl bg-white p-5 text-sm shadow-sm">
            <h2 className="mb-2 font-semibold">Orders by status</h2>
            <ul className="space-y-1">{r.statuses.map(([s, c]) => <li key={s} className="flex justify-between"><span>{statusLabels[s as OrderStatus] ?? s}</span><span className="font-medium">{c}</span></li>)}</ul>
            <p className="mt-2 text-xs text-muted">Cancelled, failed and unpaid card orders aren't counted in sales.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
