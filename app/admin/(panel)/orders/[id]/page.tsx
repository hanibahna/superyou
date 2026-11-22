import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderActions } from "@/components/admin/OrderActions";
import { ShipmentTimeline } from "@/components/ShipmentTimeline";
import { OrderStatusControl } from "@/components/admin/OrderStatusControl";
import { requireAdmin } from "@/lib/admin-auth";
import { money } from "@/lib/format";
import { getOps } from "@/lib/ops-store";
import { getOrder, ORDER_STATUSES, orderValue, refunded, statusLabels } from "@/lib/orders";
import { refundProvider } from "@/lib/payments";
import { normPhone } from "@/lib/wa";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Beirut" });

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("orders");
  const [o, ops] = await Promise.all([getOrder((await params).id), getOps()]);
  if (!o) notFound();
  const c = o.customer;
  const back = refunded(o);
  const max = +(orderValue(o) - back).toFixed(2);
  return (
    <div>
      <Link href="/admin/orders/" className="text-sm text-muted hover:underline">← Orders</Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Order {o.id}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/admin/orders/${o.id}/invoice/`} target="_blank" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold">Invoice ↗</a>
          <OrderStatusControl id={o.id} status={o.status} options={ORDER_STATUSES.map((s) => ({ value: s, label: statusLabels[s] }))} />
        </div>
      </div>
      <p className="text-sm text-muted">{when(o.createdAt)} · {statusLabels[o.status]}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Items</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {o.lines.map((l) => (
                  <tr key={l.productId + (l.gift ? "g" : "")}>
                    <td className="py-2"><Link href={`/admin/products/${l.productId}/`} className="hover:underline">{l.brand} {l.name}</Link></td>
                    <td className="py-2 text-muted">{l.qty} × {money(l.unitPrice)}</td>
                    <td className="py-2 text-right">{money(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
              {o.discounts?.map((d) => <div key={d.name} className="flex justify-between text-brand-700"><dt>{d.name}{d.code ? ` (${d.code})` : ""}</dt><dd>−{money(d.amount)}</dd></div>)}
              {o.referral && <p className="text-xs text-muted">Referral code {o.referral}</p>}
              <div className="flex justify-between"><dt>Delivery</dt><dd>{o.delivery ? money(o.delivery) : "Free"}</dd></div>
              {o.giftCard && <div className="flex justify-between text-brand-700"><dt>Gift card {o.giftCard.code}</dt><dd>−{money(o.giftCard.amount)}</dd></div>}
              <div className="flex justify-between text-base font-semibold"><dt>{o.paymentMethod === "cod" ? "To collect" : "Paid"}</dt><dd>{money(o.total)}</dd></div>
              {back > 0 && <div className="flex justify-between text-sale"><dt>Refunded</dt><dd>−{money(back)}</dd></div>}
            </dl>
          </section>

          <OrderActions
            id={o.id}
            couriers={ops.couriers.map((x) => ({ id: x.id, name: x.name }))}
            shipment={o.shipment}
            lines={o.lines.map((l) => ({ productId: l.productId, name: `${l.brand} ${l.name}`, qty: l.qty }))}
            maxRefund={max}
            hasGiftCard={!!o.giftCard}
            paymentMethod={o.paymentMethod}
            cardGateway={refundProvider(o)?.id}
          />

          {!!o.refunds?.length && (
            <section className="rounded-xl bg-white p-5 text-sm shadow-sm">
              <h2 className="mb-2 font-semibold">Refunds</h2>
              <ul className="divide-y divide-line">
                {o.refunds.map((r) => (
                  <li key={r.id} className="py-2">
                    <div className="flex justify-between"><span>{when(r.at)} · {r.method === "giftcard" ? "store credit / gift card" : r.method}</span><b className="text-sale">−{money(r.amount)}</b></div>
                    {r.gateway && <p className="text-xs text-brand-700">Sent to card via {r.gateway.provider} · {r.gateway.status} · ref {r.gateway.ref}</p>}
                    <p className="text-muted">{r.reason || "No reason given"} · by {r.by}{r.restocked.length ? ` · ${r.restocked.reduce((s, x) => s + x.qty, 0)} item(s) back in stock` : ""}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="space-y-4">
          <div className="rounded-xl bg-white p-5 text-sm shadow-sm">
            <h2 className="mb-2 font-semibold">Customer</h2>
            <p>{c.firstName} {c.lastName}</p>
            <p><a href={`tel:${c.phone}`} className="text-brand-700">{c.phone}</a> · <a href={`https://wa.me/${normPhone(c.phone)}`} target="_blank" className="text-brand-700">WhatsApp</a></p>
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
          {o.shipment && (
            <div className="rounded-xl bg-white p-5 text-sm shadow-sm">
              <h2 className="mb-2 font-semibold">Shipping</h2>
              <p>{o.shipment.courierName}{o.shipment.tracking ? ` · ${o.shipment.tracking}` : ""}</p>
              {o.shipment.link && <a href={o.shipment.link} target="_blank" className="text-brand-700 underline">Track parcel ↗</a>}
              <p className="text-xs text-muted">Shipped {when(o.shipment.shippedAt)} by {o.shipment.by}</p>
              {o.shipment.error && <p className="mt-1 text-xs text-sale">Tracking: {o.shipment.error}</p>}
              <ShipmentTimeline status={o.shipment.status} events={o.shipment.events} checkedAt={o.shipment.checkedAt} refreshUrl={o.shipment.tracking ? `/api/admin/orders/${encodeURIComponent(o.id)}/track/` : undefined} />
            </div>
          )}
          <div className="rounded-xl bg-white p-5 text-sm shadow-sm">
            <h2 className="mb-2 font-semibold">History</h2>
            <ol className="space-y-1.5">
              {(o.history ?? [{ at: o.createdAt, status: o.status, by: "customer" }]).map((h, i) => (
                <li key={i}><b>{statusLabels[h.status]}</b> <span className="text-muted">· {when(h.at)} · {h.by}{h.note ? ` · ${h.note}` : ""}</span></li>
              ))}
            </ol>
            {o.stockTaken && <p className="mt-2 text-xs text-muted">Stock was taken off for this order.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
