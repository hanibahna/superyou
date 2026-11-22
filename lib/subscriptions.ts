import "server-only";

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { CheckoutInput, Order } from "@/lib/orders";
import { siteUrl } from "@/lib/site-url";

// Subscribe & save: products delivered every month or every 3 months at an extra discount.
// Each new order is placed automatically (cash on delivery) on the due date; the customer gets a
// WhatsApp reminder 3 days before and can skip, change, pause or cancel from a private link.
export type Subscription = {
  id: string;
  token: string;
  status: "active" | "paused" | "cancelled";
  every: 1 | 3; // months
  items: { productId: string; qty: number; name: string }[];
  customer: CheckoutInput["customer"];
  nextAt: string; // YYYY-MM-DD (Beirut)
  createdAt: string;
  orders: string[];
  remindedFor?: string; // nextAt date the reminder was sent for
  lastError?: string;
};

const K = (id: string) => `sub:${id}`;
const LIST = "subs";

export async function getSubscription(id: string): Promise<Subscription | null> {
  const raw = await db.cmd<string | null>(["GET", K(id)]);
  return raw ? (JSON.parse(raw) as Subscription) : null;
}
export async function saveSubscription(s: Subscription) {
  await db.cmd(["SET", K(s.id), JSON.stringify(s)]);
  await db.cmd(["ZADD", LIST, String(Date.parse(s.createdAt)), s.id]);
}
export async function listSubscriptions(limit = 1000): Promise<Subscription[]> {
  const ids = await db.cmd<string[]>(["ZREVRANGE", LIST, "0", String(limit - 1)]).catch(() => [] as string[]);
  const out = await Promise.all(ids.map(getSubscription));
  return out.filter((x): x is Subscription => !!x);
}

export const today = () => new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);
export function addMonths(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
export const manageLink = (s: Subscription) => `${siteUrl()}/subscription/?id=${s.id}&t=${s.token}`;
export const prettyDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** After checkout: one subscription per plan (monthly / every 3 months) in the order. */
export async function startSubscriptions(order: Order, input: CheckoutInput) {
  const wa = await import("@/lib/whatsapp");
  for (const every of [1, 3] as const) {
    const lines = order.lines.filter((l) => l.every === every && !l.gift);
    if (!lines.length) continue;
    const s: Subscription = {
      id: `SUB-${Date.now().toString(36).toUpperCase()}${every}`,
      token: randomBytes(16).toString("hex"),
      status: "active",
      every,
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty, name: `${l.brand} ${l.name}` })),
      customer: input.customer,
      nextAt: addMonths(today(), every),
      createdAt: new Date().toISOString(),
      orders: [order.id],
    };
    await saveSubscription(s);
    await wa.trigger("subscriptionStarted", s.customer.phone, { first_name: s.customer.firstName, items: s.items.map((i) => `${i.qty}× ${i.name}`).join(", ").slice(0, 900), every: every === 1 ? "every month" : "every 3 months", next_date: prettyDate(s.nextAt), link: manageLink(s) }).catch(() => false);
  }
}

/** Daily (cron): reminders 3 days ahead, and today's orders. */
export async function runSubscriptions() {
  const growth = await (await import("@/lib/growth-store")).getGrowth();
  if (!growth.subscribe.enabled) return { reminded: 0, placed: 0, failed: 0 };
  const { createOrder } = await import("@/lib/orders");
  const { serverQuote } = await import("@/lib/pricing");
  const wa = await import("@/lib/whatsapp");
  const now = today();
  const soon = addDays(now, 3);
  let reminded = 0, placed = 0, failed = 0;
  for (const s of (await listSubscriptions()).filter((x) => x.status === "active")) {
    const items = s.items.map((i) => ({ productId: i.productId, qty: i.qty, every: s.every }));
    if (s.nextAt <= soon && s.nextAt > now && s.remindedFor !== s.nextAt) {
      const q = await serverQuote({ items, zone: s.customer.zone }).catch(() => null);
      await wa.trigger("subscriptionReminder", s.customer.phone, { first_name: s.customer.firstName, items: s.items.map((i) => `${i.qty}× ${i.name}`).join(", ").slice(0, 900), next_date: prettyDate(s.nextAt), total: q ? `$${q.total.toFixed(2)}` : "", link: manageLink(s) }).catch(() => false);
      s.remindedFor = s.nextAt;
      await saveSubscription(s);
      reminded++;
    }
    if (s.nextAt <= now) {
      try {
        // Items that sold out or left the shop are skipped this time; the rest ships.
        const q = await serverQuote({ items, zone: s.customer.zone });
        const ok = items.filter((i) => q.lines.find((l) => l.productId === i.productId)?.available);
        if (!ok.length) throw new Error("Everything in this subscription is out of stock");
        const o = await createOrder({ items: ok, customer: s.customer, paymentMethod: "cod", waUpdates: true, subscriptionId: s.id });
        s.orders.push(o.id);
        s.lastError = undefined;
        placed++;
      } catch (e) {
        s.lastError = `${now}: ${e instanceof Error ? e.message : String(e)}`;
        failed++;
      }
      s.nextAt = addMonths(s.nextAt, s.every);
      await saveSubscription(s);
    }
  }
  return { reminded, placed, failed };
}

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
