import { siteUrl } from "@/lib/site-url";
import { normPhone } from "@/lib/wa";
import { everySchema, forSchema, startSchema, type Every } from "@/lib/every";
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
import { attributionSchema, type Attribution } from "@/lib/marketing";

export const checkoutSchema = z.object({
  items: z.array(z.object({ productId: z.string(), qty: z.number().int().min(1).max(20), every: everySchema.optional(), start: startSchema.optional(), forMonths: forSchema.optional() })).min(1),
  subscriptionId: z.string().max(40).optional(), // set when the order is placed by a subscription (server only)
  customer: z.object({
    firstName: z.string().min(1).max(60),
    lastName: z.string().min(1).max(60),
    phone: z.string().min(6).max(20),
    email: z.string().email().optional().or(z.literal("")),
    zone: z.string().min(1),
    city: z.string().min(1).max(80),
    address: z.string().min(3).max(300),
    notes: z.string().max(500).optional(),
    lat: z.number().min(-90).max(90).optional(), // map pin
    lng: z.number().min(-180).max(180).optional(),
  }),
  paymentMethod: z.enum(["cod", "card", "whish"]),
  code: z.string().max(40).optional(),
  waUpdates: z.boolean().optional(), // order updates on WhatsApp
  waOffers: z.boolean().optional(), // marketing opt-in
  gifts: z.array(z.object({ tierId: z.string().max(40), productIds: z.array(z.string().max(60)).max(10) })).max(20).optional(),
  joinClub: z.boolean().optional(), // SuperYou Club loyalty
  prime: z.enum(["trial", "join"]).optional(), // SuperPrime: start the free trial, or pay a month
  birthday: z.string().regex(/^\d{2}-\d{2}$/).optional().or(z.literal("")),
  giftCard: z.string().max(30).optional(),
  // Where the shopper came from (campaign tags); a bad value is dropped, never blocks the order.
  attribution: attributionSchema.optional().catch(undefined),
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
  lines: Array<{ productId: string; name: string; brand: string; unitPrice: number; qty: number; lineTotal: number; gift?: boolean; every?: Every; start?: string; forMonths?: number }>;
  subscriptionId?: string; // placed automatically by this subscription
  subtotal: number;
  discount?: number;
  discounts?: { name: string; code?: string; amount: number }[];
  code?: string;
  referral?: string; // a member's REF- code used on a first order
  attribution?: Attribution; // campaign the shopper came from (Admin → Campaigns & ads)
  delivery: number;
  total: number; // what the customer pays now (after any gift card)
  currency: string;
  customer: CheckoutInput["customer"];
  giftCard?: { code: string; amount: number };
  stockTaken?: boolean; // tracked stock was taken off for this order
  shipment?: {
    courier: string; courierName: string; tracking: string; link: string; shippedAt: string; by: string;
    /** Live tracking from the courier's system (lib/tracking). */
    status?: "pending" | "in_transit" | "out_for_delivery" | "delivered" | "exception"; events?: { at: string; text: string; place?: string }[]; checkedAt?: string; error?: string;
  };
  refunds?: Refund[];
  /** A gift card bought on the site: issued and sent to the recipient once paid. */
  giftCardPurchase?: { amount: number; recipient: string; phone: string; email: string; message: string; from: string; code?: string; sentAt?: string };
  history?: { at: string; status: OrderStatus; by: string; note?: string }[];
  /** Test order (placed from the admin or while signed in with test mode on): kept apart from real orders. */
  test?: boolean;
  /** Supplier → courier → customer (lib/fulfil). */
  fulfil?: { stage: "sent" | "ready" | "picked" | "delivered"; sentAt?: string; readyAt?: string; pickedAt?: string; deliveredAt?: string; pod?: string; podFrom?: "page" | "whatsapp"; payable?: number; paidAt?: string };
};

export type Refund = { id: string; at: string; amount: number; reason: string; method: "cash" | "card" | "whish" | "giftcard" | "other"; restocked: { productId: string; qty: number }[]; by: string; gateway?: { provider: string; ref: string; status: string } };

export const refunded = (o: Order) => +(o.refunds ?? []).reduce((s, r) => s + r.amount, 0).toFixed(2);
/** What the order is worth: money paid plus any gift card used. */
export const orderValue = (o: Order) => +(o.total + (o.giftCard?.amount ?? 0)).toFixed(2);

/** Recompute every price, discount, gift and delivery fee on the server — never trust client totals. */
const spDay = () => new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10); // Beirut date
const spUsedKey = (phone: string) => `sp:used:${normPhone(phone)}:${spDay()}`;

export async function priceOrder(input: CheckoutInput) {
  const base = { items: input.items, code: input.code, zone: input.customer.zone, subscriptionId: input.subscriptionId, phone: input.customer.phone, prime: input.prime };
  let q = await serverQuote(base);
  // SuperPrice: one order per customer (phone number) per day. The first try explains it;
  // placing the order again within 10 minutes buys those items at the regular price.
  const { getGrowth: gg } = await import("@/lib/growth-store");
  const g0 = await gg();
  const primeMember = q.prime?.status === "trial" || q.prime?.status === "active" || !!q.prime?.choice;
  if (q._lines.some((l) => l.superPrice) && g0.priceMatch.oncePerDay && !(primeMember && g0.prime.unlimitedSuperPrice) && normPhone(input.customer.phone)) {
    const { db } = await import("@/lib/db");
    if (await db.cmd(["EXISTS", spUsedKey(input.customer.phone)])) {
      const warn = `sp:warned:${normPhone(input.customer.phone)}`;
      if (!(await db.cmd(["EXISTS", warn]))) {
        await db.cmd(["SET", warn, "1", "EX", 600]);
        throw new Error("SuperPrice is one order per customer per day, and this number already used it today. Place the order again to buy these items at the regular price, or come back tomorrow.");
      }
      q = await serverQuote({ ...base, noSuperPrice: true });
    }
  }
  const { isSubscribable } = await import("@/lib/subscribable");
  // Only products that run out can be subscribed (AI lifespan database, else the name rules).
  const { getIndex: idx0 } = await import("@/lib/catalog");
  const index0 = await idx0();
  const lives = await (await import("@/lib/lifespan")).getLives(input.items.filter((i) => i.every).map((i) => index0.byId.get(i.productId)?.slug ?? ""));
  const everyOf = (id: string) => {
    const l = q._lines.find((x) => x.productId === id);
    if (!l) return undefined;
    const life = lives.get(index0.byId.get(id)?.slug ?? "");
    const ok = life ? life.every > 0 : isSubscribable({ name: l.name, category: l.category });
    return ok ? input.items.find((i) => i.productId === id)?.every : undefined;
  };
  for (const i of input.items) {
    const l = q.lines.find((x) => x.productId === i.productId);
    if (!l) throw new Error("A product in your cart is no longer available. Please review your cart.");
    if (!l.available) throw new Error(`${q._lines.find((x) => x.productId === i.productId)?.name ?? "An item"} is out of stock`);
  }
  // Tracked stock: don't sell more than is on the shelf.
  const { getIndex } = await import("@/lib/catalog");
  const idx = await getIndex();
  for (const i of input.items) {
    const p = idx.byId.get(i.productId);
    if (p?.stock !== undefined && i.qty > p.stock) throw new Error(p.stock > 0 ? `Only ${p.stock} left of ${p.name}. Please lower the quantity.` : `${p.name} just sold out.`);
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
  const lines: Order["lines"] = q._lines.map((l) => ({ productId: l.productId, name: l.name, brand: l.brand, unitPrice: l.price, qty: l.qty, lineTotal: +(l.price * l.qty).toFixed(2), ...(everyOf(l.productId) ? { every: everyOf(l.productId), ...(input.items.find((i) => i.productId === l.productId)?.start ? { start: input.items.find((i) => i.productId === l.productId)!.start } : {}), ...(input.items.find((i) => i.productId === l.productId)?.forMonths ? { forMonths: input.items.find((i) => i.productId === l.productId)!.forMonths } : {}) } : {}) }));
  for (const g of allowedGifts(q, input.gifts ?? []))
    lines.push({ productId: g.id, name: `FREE GIFT: ${g.name}`, brand: g.brand, unitPrice: 0, qty: 1, lineTotal: 0, gift: true });
  // Club members-only price: an extra % off (a collection or everything), recognised by phone number.
  const gs = await import("@/lib/growth-store");
  const growth = await gs.getGrowth();
  if (growth.club.enabled && growth.club.memberPrice.enabled && growth.club.memberPrice.percent > 0 && (await gs.getMember(input.customer.phone))) {
    const mp = growth.club.memberPrice;
    let eligible = q._lines.filter((l) => !l.superPrice); // no member price on top of a SuperPrice
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
      if (q.prime?.free && q.subtotal - q.discountTotal >= growth.prime.freeMin) q.delivery = 0;
      q.total = +(q.subtotal - q.discountTotal + q.delivery + (q.prime?.fee ?? 0)).toFixed(2);
    }
  }
  // SuperPrime month bought with this order: shown as its own line.
  if (q.prime?.fee) lines.push({ productId: "superprime", name: `${growth.prime.name} membership (30 days)`, brand: "SuperYou", unitPrice: q.prime.fee, qty: 1, lineTotal: q.prime.fee });
  let giftCard: Order["giftCard"];
  if (input.giftCard) {
    const { giftCardFor } = await import("@/lib/pricing");
    const gc = await giftCardFor(input.giftCard, q.total);
    if ("error" in gc) throw new Error(gc.error);
    if (gc.amount > 0) giftCard = { code: gc.code, amount: gc.amount };
  }
  return {
    lines,
    giftCard,
    subtotal: q.subtotal,
    discount: q.discountTotal,
    discounts: q.discounts,
    code: q.discounts.some((d) => d.code) && !referral ? input.code : undefined,
    referral,
    delivery: q.delivery,
    total: +(q.total - (giftCard?.amount ?? 0)).toFixed(2),
    _prefix: q._settings.store.name,
    _superPrice: q._lines.some((l) => l.superPrice),
    _prime: q.prime?.choice,
  };
}

export async function createOrder(input: CheckoutInput, opts: { test?: boolean } = {}): Promise<Order> {
  const test = !!opts.test;
  const { _prefix, _superPrice, _prime, ...priced } = await priceOrder(input);
  if (!test && _superPrice && normPhone(input.customer.phone)) await (await import("@/lib/db")).db.cmd(["SET", spUsedKey(input.customer.phone), "1", "EX", 2 * 86400]).catch(() => {});
  if (priced.code && !test) {
    await countCouponUse(priced.code).catch(() => {});
    await (await import("@/lib/growth-store")).useVoucher(priced.code).catch(() => {});
  }
  const id = `${test ? "TST" : _prefix.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase() || "ORD"}-${Date.now().toString(36).toUpperCase()}`;
  // Gift card first: if the balance has gone meanwhile, nothing else has happened yet.
  if (priced.giftCard && !test) await (await import("@/lib/giftcards")).spendGiftCard(priced.giftCard.code, priced.giftCard.amount, id);
  const status: OrderStatus = priced.total === 0 ? "paid" : input.paymentMethod === "cod" ? "pending_cod" : "awaiting_payment";
  const order: Order = {
    id,
    accessToken: randomBytes(16).toString("hex"),
    createdAt: new Date().toISOString(),
    status,
    paymentMethod: input.paymentMethod,
    ...priced,
    currency: "USD",
    customer: input.customer,
    ...(input.attribution && Object.keys(input.attribution).length ? { attribution: input.attribution } : {}),
    ...(input.subscriptionId ? { subscriptionId: input.subscriptionId } : {}),
    history: [{ at: new Date().toISOString(), status, by: test ? "test" : "customer" }],
    ...(test ? { test: true } : {}),
  };
  // Test orders don't touch stock, coupons, gift cards, club points, subscriptions or referral credit.
  const moves = test ? [] : await (await import("@/lib/inventory")).adjustStock(order.lines.map((l) => ({ productId: l.productId, delta: -l.qty })), `Order ${order.id}`).catch((e) => (console.error("[stock]", e), []));
  order.stockTaken = moves.length > 0;
  await saveOrder(order);
  if (!test) await (await import("@/lib/carts")).cartConverted(order.customer.phone, order.id).catch(() => {});
  const c = order.customer;
  await (await import("@/lib/address-store")).rememberServerAddress(c.phone, { zone: c.zone, city: c.city, address: c.address, notes: c.notes || undefined, lat: c.lat, lng: c.lng }).catch(() => {});
  await onOrderCreated(order, input).catch((e) => console.error("[whatsapp] order", e));
  // Internal sheet (cost, supplier, profit) to the orders inbox; never shown to the customer.
  await (await import("@/lib/order-internal")).sendOrderSheet(order).catch((e) => console.error("[order sheet]", e));
  // Supplier's products: barcode label + pick list to the supplier (Admin › Operations › Fulfilment).
  if (order.status !== "awaiting_payment") await (await import("@/lib/fulfil")).sendToSupplier(order).catch((e) => console.error("[fulfil]", e));
  if (test) return order;
  if (order.code) await (await import("@/lib/influencers")).creditOrder(order).catch((e) => console.error("[influencer]", e));
  // New subscriptions (not for orders a subscription placed itself).
  if (!input.subscriptionId && order.lines.some((l) => l.every)) await (await import("@/lib/subscriptions")).startSubscriptions(order, input).catch((e) => console.error("[subscriptions]", e));
  // SuperPrime: start the free trial, or add the 30 days paid for with this order.
  if (_prime) {
    const g = await (await import("@/lib/growth-store")).getGrowth();
    await (await import("@/lib/prime")).activatePrime(order.customer.phone, _prime, g.prime.trialMonths, order.id).catch((e) => console.error("[prime]", e));
  }
  return order;
}

/** Save the customer as a WhatsApp contact and send "order received". */
async function onOrderCreated(order: Order, input: CheckoutInput) {
  const [{ getIndex }, wa] = await Promise.all([import("@/lib/catalog"), import("@/lib/whatsapp")]);
  // Test order: only the "order received" message (to the number typed), no contact list, club or offers.
  if (order.test) {
    const v = orderVars(order);
    const ok = await wa.trigger("orderPlaced", order.customer.phone, v);
    await (await import("@/lib/sms")).smsForOrder("orderPlaced", order.customer.phone, v, ok).catch(() => {});
    return;
  }
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
  const sent = await wa.trigger("orderPlaced", order.customer.phone, vars);
  await (await import("@/lib/sms")).smsForOrder("orderPlaced", order.customer.phone, vars, sent).catch((e) => console.error("[sms]", e));
  if (res?.newOptIn) await wa.trigger("welcomeOptIn", order.customer.phone, vars);
}

function orderVars(o: Order): Record<string, string> {
  const site = siteUrl();
  return {
    first_name: o.customer.firstName, name: `${o.customer.firstName} ${o.customer.lastName}`, order_id: o.id, total: `$${o.total.toFixed(2)}`,
    items: o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ").slice(0, 900), link: site ? `${site}/order/?id=${o.id}&t=${o.accessToken}` : "",
    courier: o.shipment?.courierName ?? "", tracking: o.shipment?.tracking ?? "", tracking_link: o.shipment?.link || (site ? `${site}/order/?id=${o.id}&t=${o.accessToken}` : ""),
  };
}

// ── Storage (shared database, see lib/db.ts) ─────────────────

export async function saveOrder(order: Order) {
  await db.pipeline([
    ["SET", `order:${order.id}`, JSON.stringify(order)],
    ["ZADD", order.test ? "orders:test" : "orders", Date.parse(order.createdAt), order.id],
  ]);
}

export async function getOrder(id: string): Promise<Order | null> {
  const raw = await db.cmd<string | null>(["GET", `order:${id}`]);
  return raw ? (JSON.parse(raw) as Order) : null;
}

/** Newest first. */
export async function listOrders(offset = 0, limit = 50, test = false): Promise<{ orders: Order[]; total: number }> {
  const key = test ? "orders:test" : "orders";
  const [ids, total] = await Promise.all([
    db.cmd<string[]>(["ZREVRANGE", key, offset, offset + limit - 1]),
    db.cmd<number>(["ZCARD", key]),
  ]);
  const raws = ids.length ? await db.pipeline(ids.map((id) => ["GET", `order:${id}`])) : [];
  return { orders: raws.filter(Boolean).map((r) => JSON.parse(r as string) as Order), total };
}

export async function updateOrder(id: string, patch: Partial<Order>, by = "system", note?: string) {
  const order = await getOrder(id);
  if (!order) return null;
  const next: Order = { ...order, ...patch };
  const changed = patch.status && patch.status !== order.status;
  if (changed) next.history = [...(order.history ?? []), { at: new Date().toISOString(), status: patch.status!, by, note }];
  else if (patch.fulfil && note) next.history = [...(order.history ?? []), { at: new Date().toISOString(), status: order.status, by, note }];
  // Cancelled or payment failed: put tracked stock back and return any gift card money.
  if (changed && (patch.status === "cancelled" || patch.status === "payment_failed")) {
    const { getOps } = await import("@/lib/ops-store");
    if (order.stockTaken && (await getOps()).stock.restockOnCancel) {
      // Items already put back through a refund aren't counted twice.
      const back = new Map<string, number>();
      for (const r of order.refunds ?? []) for (const x of r.restocked) back.set(x.productId, (back.get(x.productId) ?? 0) + x.qty);
      await (await import("@/lib/inventory")).adjustStock(order.lines.map((l) => { const n = Math.min(l.qty, back.get(l.productId) ?? 0); back.set(l.productId, (back.get(l.productId) ?? 0) - n); return { productId: l.productId, delta: l.qty - n }; }), `Order ${order.id} ${patch.status === "cancelled" ? "cancelled" : "payment failed"}`, by).catch(() => {});
      next.stockTaken = false;
    }
    const gcBack = (order.giftCard?.amount ?? 0) - (order.refunds ?? []).filter((r) => r.method === "giftcard").reduce((s, r) => s + r.amount, 0);
    if (order.giftCard && gcBack > 0) await (await import("@/lib/giftcards")).creditGiftCard(order.giftCard.code, +gcBack.toFixed(2), `Order ${order.id} ${patch.status}`, order.id).catch(() => {});
  }
  await saveOrder(next);
  if (changed) await notifyOrderStatus(next);
  if (changed && patch.status === "paid" && order.status === "awaiting_payment" && !next.fulfil) await (await import("@/lib/fulfil")).sendToSupplier(next).catch((e) => console.error("[fulfil]", e));
  if (changed && ["delivered", "returned", "cancelled", "payment_failed"].includes(patch.status!)) await (await import("@/lib/subscriptions")).onSubscriptionOrder(next).catch((e) => console.error("[subscriptions]", e));
  return next;
}

/** Hand an order to a courier: saves the tracking number and sets it to Shipped (sends "on its way"). */
export async function shipOrder(id: string, courierId: string, tracking: string, by: string) {
  const { getOps } = await import("@/lib/ops-store");
  const { trackingLink } = await import("@/lib/ops");
  const ops = await getOps();
  const c = ops.couriers.find((x) => x.id === courierId);
  const shipment = { courier: courierId, courierName: c?.name ?? courierId, tracking: tracking.trim(), link: trackingLink(c, tracking.trim()), shippedAt: new Date().toISOString(), by };
  return updateOrder(id, { shipment, status: "shipped" }, by, `${shipment.courierName}${shipment.tracking ? ` · ${shipment.tracking}` : ""}`);
}

/** Record a refund (the money itself goes back through the till, the bank or the gift card). */
export async function refundOrder(id: string, r: Omit<Refund, "id" | "at" | "gateway">, toCard = false) {
  const order = await getOrder(id);
  if (!order) throw new Error("Order not found");
  const max = +(orderValue(order) - refunded(order)).toFixed(2);
  if (r.amount <= 0 || r.amount > max + 0.001) throw new Error(`You can refund up to $${max.toFixed(2)} on this order.`);
  // Card refunds go back through the gateway first: if the bank refuses, nothing else changes.
  let gateway: Refund["gateway"];
  if (r.method === "card" && toCard) {
    const { refundProvider } = await import("@/lib/payments");
    const p = refundProvider(order);
    if (!p) throw new Error("This order wasn't paid through a card gateway that can refund automatically. Refund it in your gateway's dashboard and untick “send to card”.");
    const paidByCard = +(order.total - (order.refunds ?? []).filter((x) => x.gateway).reduce((s, x) => s + x.amount, 0)).toFixed(2);
    if (r.amount > paidByCard + 0.001) throw new Error(`Only $${paidByCard.toFixed(2)} of this order was paid by card.`);
    const g = await p.refund!(order, r.amount, r.reason);
    gateway = { provider: p.id, ...g };
  }
  if (r.restocked.length) await (await import("@/lib/inventory")).adjustStock(r.restocked.map((x) => ({ productId: x.productId, delta: x.qty })), `Refund on ${order.id}`, r.by);
  if (r.method === "giftcard") {
    const gc = await import("@/lib/giftcards");
    if (order.giftCard) await gc.creditGiftCard(order.giftCard.code, r.amount, `Refund on ${order.id}`, order.id);
    else {
      const { getOps } = await import("@/lib/ops-store");
      const card = await gc.issueGiftCard({ amount: r.amount, recipient: `${order.customer.firstName} ${order.customer.lastName}`, phone: order.customer.phone, note: `Store credit for ${order.id}`, validMonths: (await getOps()).giftCards.validMonths, by: r.by });
      r = { ...r, reason: `${r.reason} — store credit ${card.code}`.trim() };
    }
  }
  const refund: Refund = { ...r, gateway, id: randomBytes(4).toString("hex"), at: new Date().toISOString() };
  const next: Order = { ...order, refunds: [...(order.refunds ?? []), refund] };
  await saveOrder(next);
  return { order: next, refund };
}

/** Hook for notifications (WhatsApp Business API, email, Slack, ERP push…). */
export async function notifyOrderStatus(order: Order) {
  console.log(`[order] ${order.id} → ${order.status} (${order.total} ${order.currency})`);
  const key = ({ confirmed: "orderConfirmed", shipped: "orderShipped", delivered: "orderDelivered" } as const)[order.status as "confirmed" | "shipped" | "delivered"];
  if (key) {
    const vars = orderVars(order);
    const sent = await (await import("@/lib/whatsapp")).trigger(key, order.customer.phone, vars);
    await (await import("@/lib/sms")).smsForOrder(key, order.customer.phone, vars, sent).catch((e) => console.error("[sms]", e));
  }
  if (order.giftCardPurchase && !order.giftCardPurchase.code && (order.status === "paid" || order.status === "delivered")) {
    await (await import("@/lib/giftcard-sale")).deliverGiftCard(order.id).catch((e) => console.error("[giftcard]", e));
  }
  if (order.status === "delivered" && !order.giftCardPurchase) {
    const gs = await import("@/lib/growth-store");
    await gs.awardPoints(order).catch((e) => console.error("[club]", e));
    await gs.scheduleAfterDelivery(order).catch((e) => console.error("[remind]", e));
    await gs.awardReferral(order).catch((e) => console.error("[referral]", e));
  }
}

/** What the customer-facing confirmation page is allowed to see. */
export function publicOrder(o: Order) {
  const { accessToken: _t, history: _h, refunds: _r, stockTaken: _s, shipment, ...rest } = o;
  const gcp = rest.giftCardPurchase;
  return {
    ...rest, refunded: refunded(o), shipment: shipment && { courierName: shipment.courierName, tracking: shipment.tracking, link: shipment.link, status: shipment.status, events: shipment.events, checkedAt: shipment.checkedAt },
    giftCardPurchase: gcp && { amount: gcp.amount, recipient: gcp.recipient, sent: !!gcp.code }, // the code goes to the recipient only
  };
}
