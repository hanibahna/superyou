// Payment method registry.
//
// Customers choose a METHOD (cash on delivery / card / Whish).
// You choose which GATEWAY processes cards with CARD_PROVIDER=tap|areeba|stripe.
// PAYMENT_METHODS controls which methods appear at checkout (default: cod,card,whish).

import type { Order } from "@/lib/orders";
import { areeba } from "./areeba";
import { stripe } from "./stripe";
import { tap } from "./tap";
import { whish } from "./whish";
import type { PaymentProvider, StartResult } from "./types";

export type MethodId = "cod" | "card" | "whish";

export const methodInfo: Record<MethodId, { label: string; description: string }> = {
  cod: { label: "Cash on delivery", description: "Pay the driver in USD or LBP when your order arrives." },
  card: { label: "Credit / debit card", description: "Visa or Mastercard, processed on a secure 3-D Secure page." },
  whish: { label: "Whish Money", description: "Pay in the Whish app or with your card on Whish's secure page." },
};

const cardProviders: Record<string, PaymentProvider> = { tap, areeba, stripe };

export function cardProvider(): PaymentProvider | null {
  const p = cardProviders[process.env.CARD_PROVIDER ?? ""];
  return p && p.isConfigured() ? p : null;
}

/** Methods to show at checkout. Card is hidden until a gateway is configured. */
export function enabledMethods(): MethodId[] {
  const wanted = (process.env.PAYMENT_METHODS ?? "cod,card,whish").split(",").map((s) => s.trim()) as MethodId[];
  return wanted.filter((m) => m in methodInfo && (m !== "card" || cardProvider() !== null));
}

/** Methods switched on in Admin → Settings, with the labels set there. */
export async function checkoutMethods() {
  const { getSettings } = await import("@/lib/site-store");
  const s = await getSettings();
  return enabledMethods()
    .filter((m) => s.payments[m].enabled)
    .map((id) => ({ id, label: s.payments[id].label, description: s.payments[id].description }));
}

/** The card gateway that took this order's payment, if it can refund through its API. */
export function refundProvider(order: Order): PaymentProvider | null {
  if (order.paymentMethod !== "card" || !order.paymentProvider) return null;
  const p = cardProviders[order.paymentProvider];
  return p && p.isConfigured() && p.refund ? p : null;
}

export async function startPayment(order: Order, baseUrl: string): Promise<StartResult & { provider?: string }> {
  switch (order.paymentMethod) {
    case "cod":
      return { kind: "confirmed" };

    case "whish":
      // With Whish API keys (WHISH_CHANNEL / WHISH_SECRET) the customer pays on Whish's page right away.
      if (whish.isConfigured()) {
        const r = await whish.start(order, { baseUrl });
        return { ...r, provider: "whish" };
      }
      // Without keys: staff send a Whish payment request by phone/WhatsApp.
      return {
        kind: "instructions",
        message: `We'll send a Whish payment request to ${order.customer.phone} shortly. Your order ships once it's paid.`,
        provider: "whish-manual",
      };

    case "card": {
      const p = cardProvider();
      if (!p) throw new Error("Card payments are not configured");
      const r = await p.start(order, { baseUrl });
      return { ...r, provider: p.id };
    }
  }
}
