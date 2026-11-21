// areeba — Mastercard Payment Gateway Services (MPGS) "Hosted Checkout".
// areeba runs on the MPGS platform; confirm the gateway host and API version
// with areeba when they issue your merchant ID.
// Env: AREEBA_MERCHANT_ID, AREEBA_API_PASSWORD,
//      AREEBA_GATEWAY_HOST (e.g. https://epayment.areeba.com), AREEBA_API_VERSION (default 100)

import type { PaymentProvider } from "./types";

const host = () => (process.env.AREEBA_GATEWAY_HOST ?? "https://epayment.areeba.com").replace(/\/$/, "");
const version = () => process.env.AREEBA_API_VERSION ?? "100";
const merchant = () => process.env.AREEBA_MERCHANT_ID!;
const auth = () => "Basic " + Buffer.from(`merchant.${merchant()}:${process.env.AREEBA_API_PASSWORD}`).toString("base64");
const base = () => `${host()}/api/rest/version/${version()}/merchant/${merchant()}`;

export const areeba: PaymentProvider = {
  id: "areeba",
  isConfigured: () => !!(process.env.AREEBA_MERCHANT_ID && process.env.AREEBA_API_PASSWORD),

  async start(order, { baseUrl }) {
    const res = await fetch(`${base()}/session`, {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify({
        apiOperation: "INITIATE_CHECKOUT",
        checkoutMode: "WEBSITE",
        interaction: {
          operation: "PURCHASE",
          merchant: { name: process.env.NEXT_PUBLIC_STORE_NAME ?? "Store" },
          returnUrl: `${baseUrl}/api/payments/areeba/return?order=${order.id}`,
        },
        order: { id: order.id, amount: order.total.toFixed(2), currency: order.currency, description: `Order ${order.id}` },
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.session?.id) throw new Error(`areeba error: ${JSON.stringify(data?.error ?? data)}`);
    order.paymentRef = data.session.id;
    // Our /pay/areeba page loads MPGS checkout.js and opens the hosted payment page.
    const q = new URLSearchParams({ session: data.session.id, host: host() });
    return { kind: "redirect", url: `${baseUrl}/pay/areeba/?${q}` };
  },
};

/** Ask the gateway for the order's real result. */
export async function getAreebaOrder(orderId: string): Promise<{ result?: string; status?: string }> {
  const res = await fetch(`${base()}/order/${encodeURIComponent(orderId)}`, { headers: { Authorization: auth() }, cache: "no-store" });
  const data = await res.json();
  return { result: data.result, status: data.status };
}
