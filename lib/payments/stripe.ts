// Stripe Checkout — only usable if the selling entity is registered in a
// Stripe-supported country (Stripe does not onboard Lebanese-registered businesses).
// Env: STRIPE_SECRET_KEY

import type { PaymentProvider } from "./types";
import { toMinor } from "./types";

const API = "https://api.stripe.com/v1";
const headers = () => ({ Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" });

export const stripe: PaymentProvider = {
  id: "stripe",
  isConfigured: () => !!process.env.STRIPE_SECRET_KEY,

  async start(order, { baseUrl }) {
    const form = new URLSearchParams({
      mode: "payment",
      client_reference_id: order.id,
      "metadata[order_id]": order.id,
      success_url: `${baseUrl}/api/payments/stripe/return?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/?cancelled=1`,
    });
    if (order.customer.email) form.set("customer_email", order.customer.email);
    const lines = [...order.lines.map((l) => ({ name: `${l.brand} ${l.name}`, amount: l.unitPrice, qty: l.qty }))];
    if (order.delivery > 0) lines.push({ name: "Delivery", amount: order.delivery, qty: 1 });
    lines.forEach((l, i) => {
      form.set(`line_items[${i}][quantity]`, String(l.qty));
      form.set(`line_items[${i}][price_data][currency]`, order.currency.toLowerCase());
      form.set(`line_items[${i}][price_data][unit_amount]`, String(toMinor(l.amount)));
      form.set(`line_items[${i}][price_data][product_data][name]`, l.name);
    });
    const res = await fetch(`${API}/checkout/sessions`, { method: "POST", headers: headers(), body: form });
    const data = await res.json();
    if (!res.ok || !data?.url) throw new Error(`Stripe error: ${data?.error?.message ?? res.status}`);
    order.paymentRef = data.id;
    return { kind: "redirect", url: data.url };
  },

  async refund(order, amount) {
    if (!order.paymentRef) throw new Error("This order has no Stripe payment to refund");
    const s = await (await fetch(`${API}/checkout/sessions/${encodeURIComponent(order.paymentRef)}`, { headers: headers(), cache: "no-store" })).json();
    if (!s?.payment_intent) throw new Error("Stripe has no payment for this order");
    const res = await fetch(`${API}/refunds`, { method: "POST", headers: headers(), body: new URLSearchParams({ payment_intent: s.payment_intent, amount: String(toMinor(amount)), reason: "requested_by_customer" }) });
    const data = await res.json();
    if (!res.ok) throw new Error(`Stripe refused the refund: ${data?.error?.message ?? res.status}`);
    return { ref: data.id, status: data.status };
  },
};

export async function getStripeSession(id: string): Promise<{ paid: boolean; orderId?: string }> {
  const res = await fetch(`${API}/checkout/sessions/${encodeURIComponent(id)}`, { headers: headers(), cache: "no-store" });
  const data = await res.json();
  return { paid: data.payment_status === "paid", orderId: data.client_reference_id };
}
