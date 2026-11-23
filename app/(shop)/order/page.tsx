"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { track } from "@/lib/track";
import { ShipmentTimeline } from "@/components/ShipmentTimeline";
import { money } from "@/lib/format";
import { useGrowth, useSettings, useT } from "@/lib/site-context";
import { celebrate } from "@/components/Celebrate";

type PublicOrder = {
  id: string;
  status: keyof typeof statusCopy;
  paymentMethod: "cod" | "card" | "whish";
  lines: { productId: string; name: string; brand: string; qty: number; lineTotal: number }[];
  subtotal: number;
  delivery: number;
  total: number;
  giftCard?: { code: string; amount: number };
  refunded?: number;
  shipment?: { courierName: string; tracking: string; link: string; status?: "pending" | "in_transit" | "out_for_delivery" | "delivered" | "exception"; events?: { at: string; text: string; place?: string }[]; checkedAt?: string };
  giftCardPurchase?: { amount: number; recipient: string; sent: boolean };
  customer: { firstName: string; phone: string; city: string; zone: string; address: string };
};

const statusCopy: Record<string, { title: string; text: string; tone: string }> = {
  pending_cod: { title: "Order confirmed!", text: "Pay the driver on delivery. We'll call you before we arrive.", tone: "text-brand-600" },
  paid: { title: "Payment received — thank you!", text: "Your order is being prepared.", tone: "text-brand-600" },
  awaiting_payment: { title: "Order received", text: "We're waiting for your payment to be confirmed.", tone: "text-amber-600" },
  payment_failed: { title: "Payment didn't go through", text: "No money was taken. Try again, or contact us to switch to cash on delivery.", tone: "text-sale" },
  confirmed: { title: "Order confirmed", text: "We're preparing your order.", tone: "text-brand-600" },
  packed: { title: "Order packed", text: "Your order is ready and will be handed to the courier soon.", tone: "text-brand-600" },
  shipped: { title: "On its way!", text: "Your order is with the courier.", tone: "text-brand-600" },
  delivered: { title: "Delivered", text: "Thank you for shopping with us.", tone: "text-brand-600" },
  cancelled: { title: "Order cancelled", text: "Contact us if this is unexpected.", tone: "text-sale" },
  returned: { title: "Order returned", text: "Contact us if you have questions about your refund.", tone: "text-muted" },
};

function OrderView() {
  const tx = useT();
  const sp = useSearchParams();
  const settings = useSettings();
  const club = useGrowth().club;
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const id = sp.get("id") ?? "";
    if (sp.get("demo")) {
      try {
        const raw = sessionStorage.getItem(`order:${id}`);
        raw ? setOrder(JSON.parse(raw)) : setMissing(true);
      } catch {
        setMissing(true);
      }
      return;
    }
    fetch(`/api/orders/${encodeURIComponent(id)}?t=${encodeURIComponent(sp.get("t") ?? "")}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setOrder)
      .catch(() => setMissing(true));
  }, [sp]);

  // Count the sale once per order with the ad platforms (same id as the server event, so it isn't doubled).
  useEffect(() => {
    if (!order || sp.get("demo") || ["payment_failed", "cancelled", "awaiting_payment"].includes(order.status)) return;
    try {
      const k = `sy:tracked:${order.id}`;
      if (localStorage.getItem(k)) return;
      localStorage.setItem(k, "1");
    } catch {}
    track({ type: "purchase", orderId: order.id, value: order.total, items: order.lines.filter((l) => l.lineTotal > 0).map((l) => ({ id: l.productId, name: l.name, brand: l.brand, price: +(l.lineTotal / l.qty).toFixed(2), qty: l.qty })) });
  }, [order, sp]);

  // A small celebration the first time a confirmed order is shown on this device.
  useEffect(() => {
    if (!order || !["pending_cod", "paid", "confirmed"].includes(order.status)) return;
    const k = `celebrated:${order.id}`;
    try { if (sessionStorage.getItem(k) || localStorage.getItem(k)) return; localStorage.setItem(k, "1"); } catch {}
    setTimeout(() => celebrate({ count: 90 }), 300);
  }, [order]);
  if (missing) return <p className="text-muted">We couldn't find that order.</p>;
  if (!order) return <p className="text-muted">{tx("Loading your order…")}</p>;
  const s = statusCopy[order.status] ?? statusCopy.awaiting_payment;
  const points = club?.enabled ? Math.floor(order.subtotal * (club.pointsPerDollar || 0)) : 0;

  return (
    <div className="mx-auto max-w-xl text-left">
      <div className="text-center">
        <h1 className={`text-3xl font-semibold ${s.tone}`}>{tx(s.title)}</h1>
        <p className="mt-2 text-muted">{tx(s.text)}</p>
        <p className="mt-4 text-sm">Order number <b>{order.id}</b></p>
      </div>
      {club?.enabled && points > 0 && !["payment_failed", "cancelled", "returned"].includes(order.status) && (
        <div className="mt-6 rounded-2xl bg-brand-50 p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{club.name || "SuperYou Club"}</p>
          <p className="mt-1 text-lg font-semibold">{tx("This order is worth")} +{points} {tx("points")}</p>
          <div className="mx-auto mt-3 h-2 max-w-xs overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sale" style={{ width: `${Math.min(100, (points / Math.max(1, club.rewardPoints)) * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">{tx("Every")} {club.rewardPoints} {tx("points becomes a")} {money(club.rewardValue)} {tx("voucher. Club members get them when the order is delivered.")}</p>
          <Link href="/club/" className="mt-3 inline-block text-sm font-semibold underline">{tx("Join free or see my points")}</Link>
        </div>
      )}
      <div className="mt-8 rounded-2xl border border-line p-6">
        <ul className="space-y-2 text-sm">
          {order.lines.map((l) => (
            <li key={l.productId} className="flex justify-between gap-4">
              <span>{l.qty} × {l.brand} {l.name}</span>
              <span>{money(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt>{tx("Delivery")}</dt><dd>{order.delivery === 0 ? tx("Free") : money(order.delivery)}</dd></div>
          {order.giftCard && <div className="flex justify-between text-brand-700"><dt>{tx("Gift card")}</dt><dd>−{money(order.giftCard.amount)}</dd></div>}
          <div className="flex justify-between text-base font-semibold"><dt>{tx("Total")}</dt><dd>{money(order.total)}</dd></div>
          {!!order.refunded && <div className="flex justify-between text-muted"><dt>{tx("Refunded")}</dt><dd>{money(order.refunded)}</dd></div>}
        </dl>
        {order.giftCardPurchase && (
          <div className="mt-4 rounded-xl bg-brand-50 p-4 text-sm">
            <p className="font-semibold">🎁 {tx("Gift card for")} {order.giftCardPurchase.recipient}</p>
            <p className="text-muted">{order.giftCardPurchase.sent ? tx("Sent! They've received their code.") : tx("It will be sent as soon as the payment is confirmed.")}</p>
          </div>
        )}
        {order.shipment && (
          <div className="mt-4 rounded-xl bg-brand-50 p-4 text-sm">
            <p className="font-semibold">{tx("Shipped with")} {order.shipment.courierName}{order.shipment.tracking ? ` · ${order.shipment.tracking}` : ""}</p>
            {order.shipment.link && <a href={order.shipment.link} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold text-brand-700 underline">{tx("Track your parcel")} ↗</a>}
            <ShipmentTimeline status={order.shipment.status} events={order.shipment.events} />
          </div>
        )}
        {!order.giftCardPurchase && <div className="mt-4 border-t border-line pt-4 text-sm text-muted">
          Delivering to {order.customer.firstName}, {order.customer.address}, {order.customer.city}, {order.customer.zone} · {order.customer.phone}
        </div>}
      </div>
      <div className="mt-6 text-center">
        <a href={`https://wa.me/${settings.store.whatsapp}?text=${encodeURIComponent(`Hello, I'd like an update on my order ${order.id}`)}`} target="_blank" rel="noreferrer" className="me-3 inline-block rounded-lg bg-[#25D366] px-6 py-3 font-semibold text-white">Track on WhatsApp</a>
        <Link href="/shop/" className="inline-block rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white">Continue shopping</Link>
        <p className="mt-4 text-xs text-muted">{tx("Bookmark this page to follow your order. You can also see all your orders in")} <Link href="/account/" className="underline">{tx("My account")}</Link> with your phone and this order number.</p>
      </div>
    </div>
  );
}

export default function OrderPage() {
  const tx = useT();
  return (
    <div className="container-x py-16 text-center">
      <Suspense fallback={<p className="text-muted">{tx("Loading…")}</p>}>
        <OrderView />
      </Suspense>
    </div>
  );
}
