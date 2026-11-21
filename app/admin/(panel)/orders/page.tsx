import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { money } from "@/lib/format";
import { listOrders, refunded, statusLabels, type OrderStatus } from "@/lib/orders";

const TABS: [string, string, OrderStatus[] | null][] = [
  ["all", "All", null],
  ["todo", "To handle", ["pending_cod", "paid", "confirmed"]],
  ["packed", "Packed", ["packed"]],
  ["shipped", "Out for delivery", ["shipped"]],
  ["unpaid", "Awaiting payment", ["awaiting_payment", "payment_failed"]],
  ["done", "Delivered", ["delivered"]],
  ["closed", "Cancelled / returned", ["cancelled", "returned"]],
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string; tab?: string; q?: string }> }) {
  await requireAdmin("orders");
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const tab = TABS.find((t) => t[0] === sp.tab) ?? TABS[0];
  const q = (sp.q ?? "").trim().toLowerCase();
  const filtering = !!tab[2] || !!q;
  // Filters look through the latest 1,000 orders.
  const res = await listOrders(filtering ? 0 : page * 50, filtering ? 1000 : 50);
  let orders = res.orders;
  if (tab[2]) orders = orders.filter((o) => tab[2]!.includes(o.status));
  if (q) orders = orders.filter((o) => `${o.id} ${o.customer.firstName} ${o.customer.lastName} ${o.customer.phone} ${o.shipment?.tracking ?? ""}`.toLowerCase().includes(q));
  const total = filtering ? orders.length : res.total;
  if (filtering) orders = orders.slice(page * 50, page * 50 + 50);
  const qs = (p: number) => `/admin/orders/?page=${p}${tab[2] ? `&tab=${tab[0]}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Orders <span className="text-base font-normal text-muted">({total})</span></h1>
        <div className="flex gap-2 text-sm">
          <Link href="/admin/orders/pickup/" className="rounded-lg border border-line bg-white px-3 py-2 font-semibold">Pickup sheet</Link>
          <Link href="/admin/carts/" className="rounded-lg border border-line bg-white px-3 py-2 font-semibold">Abandoned carts</Link>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {TABS.map((t) => <Link key={t[0]} href={`/admin/orders/?tab=${t[0]}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`rounded-full px-4 py-1.5 ${t === tab ? "bg-ink text-white" : "bg-white"}`}>{t[1]}</Link>)}
        <form className="ms-auto" action="/admin/orders/">
          {tab[2] && <input type="hidden" name="tab" value={tab[0]} />}
          <input name="q" defaultValue={sp.q} placeholder="Order, name, phone or tracking" className="w-64 rounded-lg border border-line bg-white px-3 py-1.5" />
        </form>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr><th className="p-3">Order</th><th className="p-3">Date</th><th className="p-3">Customer</th><th className="p-3">Area</th><th className="p-3">Payment</th><th className="p-3">Status</th><th className="p-3 text-right">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-[#fafbfa]">
                <td className="p-3"><Link href={`/admin/orders/${o.id}/`} className="font-medium text-brand-700 hover:underline">{o.id}</Link></td>
                <td className="p-3 whitespace-nowrap text-muted">{new Date(o.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Beirut" })}</td>
                <td className="p-3">{o.customer.firstName} {o.customer.lastName}<span className="block text-xs text-muted">{o.customer.phone}</span></td>
                <td className="p-3">{o.customer.zone}</td>
                <td className="p-3 uppercase text-xs">{o.paymentMethod}{o.giftCard ? " + gift card" : ""}</td>
                <td className="p-3">{statusLabels[o.status]}{o.shipment && <span className="block text-xs text-muted">{o.shipment.courierName}</span>}</td>
                <td className="p-3 text-right font-medium">{money(o.total)}{refunded(o) > 0 && <span className="block text-xs text-sale">−{money(refunded(o))} refunded</span>}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-muted">No orders here.</td></tr>}
          </tbody>
        </table>
      </div>
      {total > 50 && (
        <div className="mt-4 flex justify-end gap-2 text-sm">
          {page > 0 && <Link href={qs(page - 1)} className="rounded-lg border border-line bg-white px-3 py-1.5">Newer</Link>}
          {(page + 1) * 50 < total && <Link href={qs(page + 1)} className="rounded-lg border border-line bg-white px-3 py-1.5">Older</Link>}
        </div>
      )}
    </div>
  );
}
