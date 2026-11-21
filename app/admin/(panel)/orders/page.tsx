import Link from "next/link";
import { money } from "@/lib/format";
import { listOrders, statusLabels } from "@/lib/orders";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(0, Number((await searchParams).page ?? 0) || 0);
  const { orders, total } = await listOrders(page * 50, 50);
  return (
    <div>
      <h1 className="text-2xl font-semibold">Orders <span className="text-base font-normal text-muted">({total})</span></h1>
      <div className="mt-5 overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
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
                <td className="p-3 uppercase text-xs">{o.paymentMethod}</td>
                <td className="p-3">{statusLabels[o.status]}</td>
                <td className="p-3 text-right font-medium">{money(o.total)}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-muted">No orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {total > 50 && (
        <div className="mt-4 flex justify-end gap-2 text-sm">
          {page > 0 && <Link href={`/admin/orders/?page=${page - 1}`} className="rounded-lg border border-line bg-white px-3 py-1.5">Newer</Link>}
          {(page + 1) * 50 < total && <Link href={`/admin/orders/?page=${page + 1}`} className="rounded-lg border border-line bg-white px-3 py-1.5">Older</Link>}
        </div>
      )}
    </div>
  );
}
