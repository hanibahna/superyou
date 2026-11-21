import { siteUrl } from "@/lib/site-url";
import { normPhone } from "@/lib/wa";
// Orders: server-side pricing + storage.
//
// Storage: uses Upstash Redis (free tier, one-click from the Vercel Marketplace)
// when UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set; otherwise an
// in-memory map, which is fine for local dev but NOT persistent on Vercel.
// For a real launch, move orders to Postgres (Neon) or into Shopify/an ERP.

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { allowedGifts, serverQuote } from "@/lib/pricing";
import { countCouponUse } from "@/lib/site-store";

export const checkoutSchema = z.object({
  items: z.array(z.object({ productId: z.string(), qty: z.number().int().min(1).max(20) })).min(1),
  customer: z.object({
    firstName: z.string().min(1).max(60),
    lastName: z.string().min(1).max(60),
    phone: z.string().min(6).max(20),
    email: z.string().email().optional().or(z.literal("")),
    zone: z.string().min(1),
    city: z.string().min(1).max(80),
    address: z.string().min(3).max(300),
    notes: z.string().max(500).optional(),
  }),
  paymentMethod: z.enum(["cod", "card", "whish"]),
  code: z.string().max(40).optional(),
  waUpdates: z.boolean().optional(), // order updates on WhatsApp
  waOffers: z.boolean().optional(), // marketing opt-in
  gifts: z.array(z.object({ tierId: z.string().max(40), productIds: z.array(z.string().max(60)).max(10) })).max(20).optional(),
  joinClub: z.boolean().optional(), // SuperYou Club loyalty
  birthday: z.string().regex(/^\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const ORDER_STATUSES = [
  "pending_cod",
  "awaiting_payment",
  "paid",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "payment_failed",
  "cancelled",
  "returned",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const statusLabels: Record<OrderStatus, string> = {
  pending_cod: "New · cash on delivery",
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  payment_failed: "Payment failed",
  cancelled: "Cancelled",
  returned: "Returned",
};

export type Order = {
  id: string;
  accessToken: string; // lets the customer view their own confirmation page
  createdAt: string;
  status: OrderStatus;
  paymentMethod: CheckoutInput["paymentMethod"];
  paymentProvider?: string;
  paymentRef?: string; // gateway charge/session id
  lines: Array<{ productId: string; name: string; brand: string; unitPrice: number; qty: number; lineTotal: number; gift?: boolean }>;
  subtotal: number;
  discount?: number;
  discounts?: { name: string; code?: string; amount: number }[];
  code?: string;
  referral?: string; // a member's REF- code used on a first order
  delivery: number;
  total: number;
  currency: string;
  customer: CheckoutInput["customer"];
};

/** Recompute every price, discount, gift and delivery fee on the server — never trust client totals. */
export async function priceOrder(input: CheckoutInput) {
  const q = await serverQuote({ items: input.items, code: input.code, zone: input.customer.zone });
  for (const i of input.items) {
    const l = q.lines.find((x) => x.productId === i.productId);
    if (!l) throw new Error("A product in your cart is no longer available. Please review your cart.");
    if (!l.available) throw new Error(`${q._lines.find((x) => x.productId === i.productId)?.name ?? "An item"} is out of stock`);
  }
  if (input.code && q.couponError) throw new Error(q.couponError);
  // Referral codes only work on a customer's first order, and not on your own code.
  let referral: string | undefined;
  if (input.code && /^REF-/i.test(input.code.trim()) && q.discounts.some((d) => d.code)) {
    const gs = await import("@/lib/growth-store");
    const [prev, ref] = await Promise.all([gs.orderIdsByPhone(input.customer.phone, 1), gs.memberByRef(input.code)]);
    if (prev.length) throw new Error("Referral codes are for first orders only. Remove the code to continue.");
    if (ref && normPhone(ref.phone) === normPhone(input.customer.phone)) throw new Error("You can't use your own referral code.");
    referral = input.code.trim().toUpperCase();
  }
  if (q._settings.checkout.minOrder > 0 && q.subtotal < q._settings.checkout.minOrder) throw new Error(`The minimum order is $${q._settings.checkout.minOrder}.`);
  const lines: Order["lines"] = q._lines.map((l) => ({ productId: l.productId, name: l.name, brand: l.brand, unitPrice: l.price, qty: l.qty, lineTotal: +(l.price * l.qty).toFixed(2) }));
  for (const g of allowedGifts(q, input.gifts ?? []))
    lines.push({ productId: g.id, name: `FREE GIFT: ${g.name}`, brand: g.brand, unitPrice: 0, qty: 1, lineTotal: 0, gift: true });
  // Club members-only price: an extra % off (a collection or everything), recognised by phone number.
  const gs = await import("@/lib/growth-store");
  const growth = await gs.getGrowth();
  if (growth.club.enabled && growth.club.memberPrice.enabled && growth.club.memberPrice.percent > 0 && (await gs.getMember(input.customer.phone))) {
    const mp = growth.club.memberPrice;
    let eligible = q._lines;
    if (mp.collection) {
      const { collectionMembers } = await import("@/lib/listing");
      const ids = new Set((await collectionMembers(mp.collection)).map((p) => p.id));
      eligible = eligible.filter((l) => ids.has(l.productId));
    }
    const amount = +Math.min(q.subtotal - q.discountTotal, (eligible.reduce((a, l) => a + l.price * l.qty, 0) * mp.percent) / 100).toFixed(2);
    if (amount > 0) {
      q.discounts.push({ name: `${growth.club.name} member price (−${mp.percent}%)`, amount });
      q.discountTotal = +(q.discountTotal + amount).toFixed(2);
      const { deliveryFor } = await import("@/lib/site");
      q.delivery = deliveryFor(q._settings, q.subtotal - q.discountTotal, input.customer.zone);
      q.total = +(q.subtotal - q.discountTotal + q.delivery).toFixed(2);
    }
  }
  return {
    lines,
    subtotal: q.subtotal,
    discount: q.discountTotal,
    discounts: q.discounts,
    code: q.discounts.some((d) => d.code) && !referral ? input.code : undefined,
    referral,
    delivery: q.delivery,
    total: q.total,
    _prefix: q._settings.store.name,
  };
}

export async function createOrder(input: CheckoutInput): Promise<Order> {
  const { _prefix, ...priced } = await priceOrder(input);
  if (priced.code) {
    await countCouponUse(priced.code).catch(() => {});
    await (await import("@/lib/growth-store")).useVoucher(priced.code).catch(() => {});
  }
  const order: Order = {
    id: `${_prefix.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase() || "ORD"}-${Date.now().toString(36).toUpperCase()}`,
    accessToken: randomBytes(16).toString("hex"),
    createdAt: new Date().toISOString(),
    status: input.paymentMethod === "cod" ? "pending_cod" : "awaiting_payment",
    paymentMethod: input.paymentMethod,
    ...priced,
    currency: "USD",
    customer: input.customer,
  };
  await saveOrder(order);
  await onOrderCreated(order, input).catch((e) => console.error("[whatsapp] order", e));
  return order;
}

/** Save the customer as a WhatsApp contact and send "order received". */
async function onOrderCreated(order: Order, input: CheckoutInput) {
  const [{ getIndex }, wa] = await Promise.all([import("@/lib/catalog"), import("@/lib/whatsapp")]);
  const idx = await getIndex();
  const paid = order.lines.filter((l) => !l.gift);
  const res = await wa.upsertContact({
    phone: order.customer.phone,
    name: `${order.customer.firstName} ${order.customer.lastName}`,
    email: order.customer.email,
    source: "checkout",
    updates: input.waUpdates ?? true,
    offers: input.waOffers === true ? true : undefined,
    order: { total: order.total, brands: paid.map((l) => l.brand), categories: paid.map((l) => idx.byId.get(l.productId)?.category ?? "").filter(Boolean) },
  });
  const gs = await import("@/lib/growth-store");
  await gs.indexOrderByPhone(order.customer.phone, order.id).catch(() => {});
  if (input.joinClub) await gs.joinClub({ phone: order.customer.phone, name: `${order.customer.firstName} ${order.customer.lastName}`, email: order.customer.email || undefined, birthday: input.birthday || undefined }).catch(() => {});
  const vars = orderVars(order);
  await wa.trigger("orderPlaced", order.customer.phone, vars);
  if (res?.newOptIn) await wa.trigger("welcomeOptIn", order.customer.phone, vars);
}

function orderVars(o: Order): Record<string, string> {
  const site = siteUrl();
  return {
    first_name: o.customer.firstName, name: `${o.customer.firstName} ${o.customer.lastName}`, order_id: o.id, total: `$${o.total.toFixed(2)}`,
    items: o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ").slice(0, 900), link: site ? `${site}/order/?id=${o.id}&t=${o.accessToken}` : "",
  };
}

// ── Storage (shared database, see lib/db.ts) ─────────────────

export async function saveOrder(order: Order) {
  await db.pipeline([
    ["SET", `order:${order.id}`, JSON.stringify(order)],
    ["ZADD", "orders", Date.parse(order.createdAt), order.id],
  ]);
}

export async function getOrder(id: string): Promise<Order | null> {
  const raw = await db.cmd<string | null>(["GET", `order:${id}`]);
  return raw ? (JSON.parse(raw) as Order) : null;
}

/** Newest first. */
export async function listOrders(offset = 0, limit = 50): Promise<{ orders: Order[]; total: number }> {
  const [ids, total] = await Promise.all([
    db.cmd<string[]>(["ZREVRANGE", "orders", offset, offset + limit - 1]),
    db.cmd<number>(["ZCARD", "orders"]),
  ]);
  const raws = ids.length ? await db.pipeline(ids.map((id) => ["GET", `order:${id}`])) : [];
  return { orders: raws.filter(Boolean).map((r) => JSON.parse(r as string) as Order), total };
}

export async function updateOrder(id: string, patch: Partial<Order>) {
  const order = await getOrder(id);
  if (!order) return null;
  const next = { ...order, ...patch };
  await saveOrder(next);
  if (patch.status && patch.status !== order.status) await notifyOrderStatus(next);
  return next;
}

/** Hook for notifications (WhatsApp Business API, email, Slack, ERP push…). */
export async function notifyOrderStatus(order: Order) {
  console.log(`[order] ${order.id} → ${order.status} (${order.total} ${order.currency})`);
  const key = ({ confirmed: "orderConfirmed", shipped: "orderShipped", delivered: "orderDelivered" } as const)[order.status as "confirmed" | "shipped" | "delivered"];
  if (key) await (await import("@/lib/whatsapp")).trigger(key, order.customer.phone, orderVars(order));
  if (order.status === "delivered") {
    const gs = await import("@/lib/growth-store");
    await gs.awardPoints(order).catch((e) => console.error("[club]", e));
    await gs.scheduleAfterDelivery(order).catch((e) => console.error("[remind]", e));
    await gs.awardReferral(order).catch((e) => console.error("[referral]", e));
  }
}

/** What the customer-facing confirmation page is allowed to see. */
export function publicOrder(o: Order) {
  const { accessToken: _t, ...rest } = o;
  return rest;
}
