// Whish Pay — the customer pays in the Whish app (or by card on Whish's page) from a payment link.
// Env: WHISH_CHANNEL, WHISH_SECRET, WHISH_WEBSITE_URL (the site address registered with Whish),
//      WHISH_ENV=sandbox|production (default production).
// A link is not a payment: an order is marked paid only when Whish's status check says "success".

import type { Order } from "@/lib/orders";
import type { PaymentProvider } from "./types";

const host = () => (process.env.WHISH_ENV === "sandbox" ? "https://partner.api.sbx.whish.money/itel-service/api" : "https://api.whish.money/itel-service/api");
const headers = () => ({ channel: process.env.WHISH_CHANNEL!, secret: process.env.WHISH_SECRET!, websiteUrl: process.env.WHISH_WEBSITE_URL ?? "https://www.shopsuperyou.com", "Content-Type": "application/json", Accept: "application/json" });

async function call(path: string, body: Record<string, unknown>) {
  const r = await fetch(host() + path, { method: "POST", headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const t = await r.text();
  let j: { status?: boolean; code?: string; dialog?: { message?: string }; data?: Record<string, unknown> } = {};
  try { j = JSON.parse(t); } catch { throw new Error(`Whish answered HTTP ${r.status}${r.status === 403 ? " (check the website URL registered with Whish)" : ""}`); }
  if (j.status !== true) throw new Error(`Whish error: ${j.dialog?.message ?? j.code ?? "unknown"}`);
  return j.data ?? {};
}

/** Whish needs a number as the payment reference; each attempt gets a new one. */
const newRef = () => String(Date.now()) + String(Math.floor(Math.random() * 1000)).padStart(3, "0");

export const whish: PaymentProvider = {
  id: "whish",
  isConfigured: () => !!(process.env.WHISH_CHANNEL && process.env.WHISH_SECRET),

  async start(order, { baseUrl }) {
    const ref = newRef();
    const cb = (ok: boolean) => `${baseUrl}/api/payments/whish/callback?order=${encodeURIComponent(order.id)}&ref=${ref}&r=${ok ? "ok" : "fail"}`;
    const back = (ok: boolean) => `${baseUrl}/api/payments/whish/return?order=${encodeURIComponent(order.id)}&ref=${ref}&r=${ok ? "ok" : "fail"}`;
    const data = await call("/payment/whish", {
      amount: Number(order.total.toFixed(2)),
      currency: order.currency || "USD",
      invoice: `SuperYou order ${order.id}`,
      externalId: Number(ref),
      successCallbackUrl: cb(true),
      failureCallbackUrl: cb(false),
      successRedirectUrl: back(true),
      failureRedirectUrl: back(false),
    });
    const url = String(data.collectUrl ?? "");
    if (!url) throw new Error("Whish didn't return a payment link");
    order.paymentRef = ref;
    return { kind: "redirect", url };
  },
};

/** The real outcome, straight from Whish: pending | success | failed | refunded | unknown. */
export async function whishStatus(order: Pick<Order, "currency" | "paymentRef">) {
  if (!order.paymentRef) return "unknown";
  const d = await call("/payment/collect/status", { currency: order.currency || "USD", externalId: Number(order.paymentRef) });
  return String(d.collectStatus ?? "unknown");
}

/** Apply Whish's answer to the order (callbacks are only a hint; we always ask Whish). */
export async function settleWhish(orderId: string) {
  const { getOrder, updateOrder } = await import("@/lib/orders");
  const o = await getOrder(orderId);
  if (!o || o.paymentMethod !== "whish") return o;
  if (o.status !== "awaiting_payment" && o.status !== "payment_failed") return o;
  const st = await whishStatus(o).catch(() => "unknown");
  if (st === "success") return updateOrder(o.id, { status: "paid" }, "whish");
  if (st === "failed") return updateOrder(o.id, { status: "payment_failed" }, "whish");
  return o;
}

/** Daily: Whish sends each callback only once (and none when a link expires), so re-check open Whish orders. */
export async function sweepWhish() {
  if (!whish.isConfigured()) return 0;
  const { listOrders } = await import("@/lib/orders");
  const { orders } = await listOrders(0, 300);
  let n = 0;
  for (const o of orders.filter((x) => x.paymentMethod === "whish" && x.status === "awaiting_payment" && x.paymentRef)) {
    const after = await settleWhish(o.id).catch(() => null);
    if (after && after.status !== o.status) n++;
  }
  return n;
}
