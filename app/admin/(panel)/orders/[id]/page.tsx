import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusControl } from "@/components/admin/OrderStatusControl";
import { money } from "@/lib/format";
import { getOrder, ORDER_STATUSES, statusLabels } from "@/lib/orders";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const o = await getOrder((await params).id);
  if (!o) notFound();
  const c = o.customer;
  return (
    <div>
      <Link href="/admin/orders/" className="text-sm text-muted hover:underline">← Orders</Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Order {o.id}</h1>
        <OrderStatusControl id={o.id} status={o.status} options={ORDER_STATUSES.map((s) => ({ value: s, label: statusLabels[s] }))} />
      </div>
      <p className="text-sm text-muted">{new Date(o.createdAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Beirut" })}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">Items</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {o.lines.map((l) => (
                <tr key={l.productId}>
                  <td className="py-2"><Link href={`/admin/products/${l.productId}/`} className="hover:underline">{l.brand} {l.name}</Link></td>
                  <td className="py-2 text-muted">{l.qty} × {money(l.unitPrice)}</td>
                  <td className="py-2 text-right">{money(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Delivery</dt><dd>{o.delivery ? money(o.delivery) : "Free"}</dd></div>
            <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{money(o.total)}</dd></div>
          </dl>
        </section>
        <section className="space-y-4">
          <div className="rounded-xl bg-white p-5 text-sm shadow-sm">
            <h2 className="mb-2 font-semibold">Customer</h2>
            <p>{c.firstName} {c.lastName}</p>
            <p><a href={`tel:${c.phone}`} className="text-brand-700">{c.phone}</a> · <a href={`https://wa.me/${c.phone.replace(/\D/g, "").replace(/^0/, "961")}`} target="_blank" className="text-brand-700">WhatsApp</a></p>
            {c.email && <p>{c.email}</p>}
            <h3 className="mt-3 font-semibold">Delivery</h3>
            <p>{c.address}</p>
            <p>{c.city}, {c.zone}</p>
            {c.notes && <p className="mt-2 rounded bg-amber-50 p-2">Note: {c.notes}</p>}
          </div>
          <div className="rounded-xl bg-white p-5 text-sm shadow-sm">
            <h2 className="mb-2 font-semibold">Payment</h2>
            <p className="uppercase">{o.paymentMethod}{o.paymentProvider ? ` · ${o.paymentProvider}` : ""}</p>
            {o.paymentRef && <p className="break-all font-mono text-xs text-muted">{o.paymentRef}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
