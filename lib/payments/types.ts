import type { Order } from "@/lib/orders";

/** What the checkout API tells the browser to do next. */
export type StartResult =
  | { kind: "confirmed" } // nothing to pay online (e.g. cash on delivery)
  | { kind: "redirect"; url: string } // send the customer to a hosted payment page
  | { kind: "instructions"; message: string }; // manual follow-up (e.g. Whish link via WhatsApp)

export interface PaymentProvider {
  id: string; // "tap" | "areeba" | "stripe" | …
  /** True when the env vars this provider needs are present. */
  isConfigured(): boolean;
  /** Create the payment for an order and say what the browser should do next. */
  start(order: Order, ctx: { baseUrl: string }): Promise<StartResult>;
}

export const toMinor = (amount: number) => Math.round(amount * 100);
