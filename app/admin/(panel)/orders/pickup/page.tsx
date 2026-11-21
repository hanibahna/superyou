import Link from "next/link";
import { PickupShip } from "@/components/admin/PickupShip";
import { PrintButton } from "@/components/admin/PrintButton";
import { requireAdmin } from "@/lib/admin-auth";
import { money } from "@/lib/format";
import { getOps } from "@/lib/ops-store";
import { listOrders, statusLabels, type OrderStatus } from "@/lib/orders";

// Printable list for the driver/courier: who, where, what to collect, signature.
export default async function PickupSheet({ searchParams }: { searchParams: Promise<{ status?: string; courier?: string }> }) {
  await requireAdmin("orders");
  const sp = await searchParams;
  const status = (sp.status ?? "packed") as OrderStatus;
  const [{ orders }, ops] = await Promise.all([listOrders(0, 500), getOps()]);
  const list = orders.filter((o) => o.status === status).reverse();
  const courier = ops.couriers.find((c) => c.id === sp.courier) ?? ops.couriers[0];
  const toCollect = list.reduce((s, o) => s + (o.paymentMethod === "cod" ? o.total : 0), 0);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href="/admin/orders/" className="text-sm text-muted hover:underline">← Orders</Link>
          <h1 className="text-2xl font-semibold">Pickup sheet</h1>
        </div>
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <select name="status" defaultValue={status} className="rounded-lg border border-line bg-white px-3 py-2">
            {(["confirmed", "packed", "pending_cod", "paid"] as OrderStatus[]).map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
          </select>
          <select name="courier" defaultValue={courier?.id} className="rounded-lg border border-line bg-white px-3 py-2">
            {ops.couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="rounded-lg border border-line bg-white px-3 py-2 font-semibold">Show</button>
          <PrintButton label="Print" />
        </form>
      </div>
      <div className="rounded-xl bg-white p-6 text-sm shadow-sm print:p-0 print:shadow-none">
        <div className="flex flex-wrap justify-between gap-2 border-b border-line pb-3">
          <p><b>SuperYou</b> → <b>{courier?.name}</b>{courier?.phone ? ` (${courier.phone})` : ""}</p>
          <p>{new Date().toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Beirut" })}</p>
          <p>{list.length} parcels · cash to collect <b>{money(toCollect)}</b></p>
        </div>
        <table className="mt-3 w-full">
          <thead className="text-left text-xs text-muted"><tr><th className="py-1">#</th><th>Order</th><th>Customer</th><th>Address</th><th>Items</th><th className="text-right">Collect</th><th className="w-28">Signature</th></tr></thead>
          <tbody className="divide-y divide-line align-top">
            {list.map((o, i) => (
              <tr key={o.id}>
                <td className="py-2">{i + 1}</td>
                <td className="py-2 font-mono text-xs">{o.id}</td>
                <td className="py-2">{o.customer.firstName} {o.customer.lastName}<span className="block">{o.customer.phone}</span></td>
                <td className="py-2">{o.customer.address}<span className="block text-muted">{o.customer.city}, {o.customer.zone}</span>{o.customer.notes && <span className="block text-xs">Note: {o.customer.notes}</span>}</td>
                <td className="py-2">{o.lines.reduce((s, l) => s + l.qty, 0)}</td>
                <td className="py-2 text-right font-semibold">{o.paymentMethod === "cod" ? money(o.total) : "Paid"}</td>
                <td className="py-2"><span className="block h-8 border-b border-dashed border-ink/40" /></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} className="py-8 text-center text-muted">No orders with status &quot;{statusLabels[status]}&quot;.</td></tr>}
          </tbody>
        </table>
      </div>
      {list.length > 0 && courier && <div className="mt-4 print:hidden"><PickupShip ids={list.map((o) => o.id)} courier={courier.id} courierName={courier.name} /></div>}
    </div>
  );
}
