// Tap Payments — hosted card page via the Charges API.
// Docs: https://developers.tap.company/reference/create-a-charge
// Env: TAP_SECRET_KEY (sk_test_… / sk_live_…)

import type { Order } from "@/lib/orders";
import type { PaymentProvider } from "./types";

const API = "https://api.tap.company/v2";

export const tap: PaymentProvider = {
  id: "tap",
  isConfigured: () => !!process.env.TAP_SECRET_KEY,

  async start(order, { baseUrl }) {
    const res = await fetch(`${API}/charges`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.TAP_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: order.total,
        currency: order.currency,
        threeDSecure: true,
        save_card: false,
        description: `Order ${order.id}`,
        reference: { transaction: order.id, order: order.id },
        customer: {
          first_name: order.customer.firstName,
          last_name: order.customer.lastName,
          email: order.customer.email || undefined,
          phone: { country_code: "961", number: order.customer.phone.replace(/\D/g, "").replace(/^961/, "") },
        },
        source: { id: "src_all" }, // show all enabled card/wallet methods
        redirect: { url: `${baseUrl}/api/payments/tap/return?order=${order.id}` },
        post: { url: `${baseUrl}/api/webhooks/tap` },
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.transaction?.url) throw new Error(`Tap error: ${JSON.stringify(data?.errors ?? data)}`);
    order.paymentRef = data.id;
    return { kind: "redirect", url: data.transaction.url };
  },

  // Refunds API: POST /v2/refunds with the original charge id.
  async refund(order, amount, reason) {
    if (!order.paymentRef) throw new Error("This order has no Tap charge to refund");
    const res = await fetch(`${API}/refunds`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.TAP_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ charge_id: order.paymentRef, amount, currency: order.currency, reason: "requested_by_customer", description: reason || `Refund on ${order.id}`, reference: { merchant: order.id } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !["REFUNDED", "PENDING", "IN_PROGRESS"].includes(data?.status)) throw new Error(`Tap refused the refund: ${data?.errors?.[0]?.description ?? data?.status ?? res.status}`);
    return { ref: data.id, status: data.status };
  },
};

/** Always re-fetch the charge from Tap rather than trusting query params or webhook bodies. */
export async function getTapCharge(chargeId: string): Promise<{ status: string; orderId?: string }> {
  const res = await fetch(`${API}/charges/${encodeURIComponent(chargeId)}`, {
    headers: { Authorization: `Bearer ${process.env.TAP_SECRET_KEY}` },
    cache: "no-store",
  });
  const data = await res.json();
  return { status: data.status, orderId: data.reference?.order };
}

export const tapStatusToOrder = (s: string): Order["status"] =>
  s === "CAPTURED" ? "paid" : ["INITIATED", "IN_PROGRESS"].includes(s) ? "awaiting_payment" : "payment_failed";
