import { fullName } from "@/lib/data/catalog";
import "server-only";

import { randomBytes } from "node:crypto";
import { everyText, MAX_MONTHS, startOk, tierOf, type Every } from "@/lib/every";
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
  every: Every; // months apart (1 to 6), chosen per product
  endsAt?: string; // last day of the plan (the customer chooses up to 6 months); no orders after it
  items: { productId: string; qty: number; name: string }[];
  customer: CheckoutInput["customer"];
  nextAt: string; // YYYY-MM-DD (Beirut)
  createdAt: string;
  orders: string[];
  remindedFor?: string; // nextAt date the reminder was sent for
  lastError?: string;
  // Earn-it rules (subscriptions started from Nov 2026). Older ones have no `rules` and keep their discount.
  rules?: 2;
  delivered?: Record<string, number>; // orderId → value of the subscribed items in it, once delivered
  unlocked?: boolean; // the discount is earned after N delivered orders
  unlockedAt?: string;
  freeShip?: boolean; // started during the campaign: delivery is free on all its orders
  fast?: boolean; // started during the "discount from the 2nd order" campaign: unlocks after the first delivery
  noRebate?: boolean; // started within the cooldown after cancelling another one: no rebate on past orders
  rebate?: { earned: number; used: number; pending: number; forfeited: number; uses: Record<string, number> };
  log?: { at: string; text: string }[];
};

export const needFor = (s: Pick<Subscription, "every" | "fast">, g: { unlockMonthly: number; unlockQuarterly: number }) => (s.fast ? 1 : s.every === 1 ? g.unlockMonthly : g.unlockQuarterly);
const pctFor = (e: number, g: { monthly: number; quarterly: number }) => (tierOf(e) === "monthly" ? g.monthly : g.quarterly);
const R = (s: Subscription) => (s.rebate ??= { earned: 0, used: 0, pending: 0, forfeited: 0, uses: {} });
const note = (s: Subscription, text: string) => { s.log = [...(s.log ?? []), { at: new Date().toISOString(), text }].slice(-40); };
const OIDX = (orderId: string) => `subord:${orderId}`;
const CANCELLED = (phone: string) => `subcancel:${phone.replace(/\D/g, "")}`;

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

/** After checkout: one subscription per plan (monthly / every 3 months) in the order. A product the
 * customer already gets on another active subscription isn't added twice. */
export async function startSubscriptions(order: Order, input: CheckoutInput) {
  const g = (await (await import("@/lib/growth-store")).getGrowth()).subscribe;
  const phone = input.customer.phone.replace(/\D/g, "");
  const mine = (await listSubscriptions()).filter((x) => x.status !== "cancelled" && x.customer.phone.replace(/\D/g, "") === phone);
  const already = new Set(mine.flatMap((x) => x.items.map((i) => i.productId)));
  const lastCancel = Number(await db.cmd<string | null>(["GET", CANCELLED(phone)]).catch(() => null)) || 0;
  const fast = (await import("@/lib/growth")).subPromoLive({ subscribe: g });
  const cooling = g.cooldownDays > 0 && Date.now() - lastCancel < g.cooldownDays * 864e5;
  const made: string[] = [];
  // One subscription per plan: same frequency and same next date chosen on the calendar.
  const keyOf = (l: Order["lines"][number]) => `${l.every}|${startOk(l.start) ? l.start : ""}|${Math.min(MAX_MONTHS, l.forMonths || MAX_MONTHS)}`;
  for (const key of [...new Set(order.lines.filter((l) => l.every).map(keyOf))]) {
    const [e, start, months] = key.split("|");
    const every = Number(e) as Every;
    const lines = order.lines.filter((l) => l.every && keyOf(l) === key && !l.gift && !already.has(l.productId));
    if (!lines.length) continue;
    const s: Subscription = {
      id: `SUB-${Date.now().toString(36).toUpperCase()}${every}${made.length || ""}`,
      token: randomBytes(16).toString("hex"),
      status: "active",
      every,
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty, name: `${fullName(l.brand, l.name)}` })),
      customer: input.customer,
      nextAt: start || addMonths(today(), every),
      endsAt: addMonths(today(), Number(months) || MAX_MONTHS),
      createdAt: new Date().toISOString(),
      orders: [order.id],
      rules: 2,
      delivered: {},
      rebate: { earned: 0, used: 0, pending: 0, forfeited: 0, uses: {} },
      ...(cooling ? { noRebate: true } : {}),
      // Campaign: the discount starts on the 2nd order (no money back on the first).
      ...(!cooling && fast ? { fast: true, noRebate: true } : {}),
      ...(fast && g.promo?.freeDelivery ? { freeShip: true } : {}),
      log: [{ at: new Date().toISOString(), text: `Started with order ${order.id}${cooling ? " (no rebate on past orders: cancelled another subscription recently)" : ""}` }],
    };
    await saveSubscription(s);
    made.push(s.id);
    await notify("started", s, { percent: pctFor(every, g), deliveries: needFor(s, g), rebate: 0 }).catch(() => {});
  }
  await linkOrder(order.id, made);
}

/** Tell the customer on WhatsApp (text message if WhatsApp didn't reach them) and by email. */
async function notify(kind: "started" | "unlocked", s: Subscription, v: { percent: number; deliveries: number; rebate: number }) {
  const wa = await import("@/lib/whatsapp");
  const { smsForOrder } = await import("@/lib/sms");
  const { sendEmail } = await import("@/lib/email");
  const every = everyText(s.every);
  const vars = { first_name: s.customer.firstName, items: s.items.map((i) => `${i.qty}× ${i.name}`).join(", ").slice(0, 900), every, next_date: prettyDate(s.nextAt), link: manageLink(s), percent: String(v.percent), deliveries: String(v.deliveries), rebate: `$${v.rebate.toFixed(2)}` };
  const terms = `${siteUrl()}/pages/subscription-terms/`;
  if (kind === "started") {
    const sent = await wa.trigger("subscriptionStarted", s.customer.phone, vars).catch(() => false);
    await smsForOrder("subscriptionStarted", s.customer.phone, vars, sent).catch(() => {});
    if (s.customer.email) await sendEmail(s.customer.email, "Your SuperYou subscription is set", `Hi ${vars.first_name},

Your Subscribe & save plan is set: ${vars.items}, delivered ${every}. Your next order will be placed on ${vars.next_date} (pay on delivery). We'll remind you on WhatsApp 3 days before.

How your discount works
• Your first ${v.deliveries} deliveries are at the normal price.
• Once they're delivered, ${v.percent}% off unlocks on every subscription order.
• You also get ${v.percent}% back on those first ${v.deliveries} orders, taken off your next deliveries (up to the limit per order in our terms). It isn't paid in cash.
• Skipped months don't count, and returned or cancelled orders are taken out of the count.
• If you cancel before using your rebate, it's lost.

Track your progress, skip, change or cancel any time: ${vars.link}
Full terms: ${terms}

SuperYou`).catch(() => false);
  } else {
    const sent = await wa.trigger("subscriptionUnlocked", s.customer.phone, vars).catch(() => false);
    await smsForOrder("subscriptionUnlocked", s.customer.phone, vars, sent).catch(() => {});
    if (s.customer.email) await sendEmail(s.customer.email, `You've unlocked ${v.percent}% off your SuperYou subscription`, `Hi ${vars.first_name},

Thank you! You've completed ${v.deliveries} subscription deliveries, so ${v.percent}% off is now unlocked on every subscription order.
${v.rebate > 0 ? `
Your rebate of ${vars.rebate} on the orders you've already received comes off your next delivery on ${vars.next_date} (up to the limit per order in our terms; any balance carries to the following deliveries).
` : ""}
See your subscription: ${vars.link}
Terms: ${terms}

SuperYou`).catch(() => false);
  }
}

/** Remember which subscriptions an order belongs to (its first order, or one it placed itself). */
async function linkOrder(orderId: string, subIds: string[]) {
  if (subIds.length) await db.cmd(["SET", OIDX(orderId), JSON.stringify(subIds)]).catch(() => {});
}

/** Order status changed: count delivered orders, unlock the discount and rebate, reverse on return. */
export async function onSubscriptionOrder(order: Order) {
  const raw = await db.cmd<string | null>(["GET", OIDX(order.id)]).catch(() => null);
  const ids: string[] = raw ? JSON.parse(raw) : order.subscriptionId ? [order.subscriptionId] : [];
  if (!ids.length) return;
  const g = (await (await import("@/lib/growth-store")).getGrowth()).subscribe;
  for (const id of ids) {
    const s = await getSubscription(id);
    if (!s || !s.rules) continue;
    const r = R(s);
    s.delivered ??= {};
    const pct = pctFor(s.every, g);
    const subIds = new Set(s.items.map((i) => i.productId));
    const value = +order.lines.filter((l) => !l.gift && subIds.has(l.productId) && (order.subscriptionId ? true : l.every === s.every)).reduce((a, l) => a + l.lineTotal, 0).toFixed(2);
    if (order.status === "delivered" && !(order.id in s.delivered)) {
      s.delivered[order.id] = value;
      note(s, `Order ${order.id} delivered (${Object.keys(s.delivered).length} of ${needFor(s, g)})`);
      await (await import("@/lib/game")).refillStreak(s, Object.keys(s.delivered).length).catch(() => {});
      if (s.unlocked && order.subscriptionId) { /* already unlocked: the discount was on the order itself */ }
      if (!s.unlocked && Object.keys(s.delivered).length >= needFor(s, g)) {
        s.unlocked = true;
        s.unlockedAt = new Date().toISOString();
        const back = s.noRebate ? 0 : +((Object.values(s.delivered).reduce((a, v) => a + v, 0) * pct) / 100).toFixed(2);
        r.earned = +(r.earned + back).toFixed(2);
        r.pending = +(r.pending + back).toFixed(2);
        note(s, `Unlocked: ${pct}% off from now on${back ? `, $${back.toFixed(2)} rebate on past orders` : ""}`);
        await notify("unlocked", s, { percent: pct, deliveries: Object.keys(s.delivered).length, rebate: back }).catch(() => {});
      }
    }
    if ((order.status === "returned" || order.status === "cancelled" || order.status === "payment_failed")) {
      if (order.id in s.delivered) {
        const v = s.delivered[order.id];
        delete s.delivered[order.id];
        if (s.unlocked && !s.noRebate) {
          const take = Math.min(r.pending, +((v * pct) / 100).toFixed(2));
          r.pending = +(r.pending - take).toFixed(2);
          r.earned = +(r.earned - take).toFixed(2);
        }
        if (s.unlocked && Object.keys(s.delivered).length < needFor(s, g)) { s.unlocked = false; note(s, `Order ${order.id} ${order.status}: discount locked again until ${needFor(s, g)} orders are delivered`); }
        else note(s, `Order ${order.id} ${order.status}: removed from the count`);
      }
      // A rebate used on an order that didn't go through goes back to the customer.
      const used = r.uses[order.id];
      if (used) { r.pending = +(r.pending + used).toFixed(2); r.used = +(r.used - used).toFixed(2); delete r.uses[order.id]; note(s, `$${used.toFixed(2)} rebate restored (order ${order.id} ${order.status})`); }
    }
    await saveSubscription(s);
  }
}

/** Customer or admin cancelled: an unused rebate is lost, and a new one can't be earned for a while. */
export async function cancelSubscription(s: Subscription, by: string) {
  s.status = "cancelled";
  const r = R(s);
  if (r.pending > 0) { r.forfeited = +(r.forfeited + r.pending).toFixed(2); note(s, `Cancelled by ${by}: $${r.pending.toFixed(2)} unused rebate forfeited`); r.pending = 0; }
  else note(s, `Cancelled by ${by}`);
  await db.cmd(["SET", CANCELLED(s.customer.phone), String(Date.now())]).catch(() => {});
}

/** Pricing for a subscription's own order: the earned % (or the old discount for older subscriptions) and the rebate. */
export async function subscriptionPricing(id: string) {
  const s = await getSubscription(id);
  if (!s) return null;
  const g = (await (await import("@/lib/growth-store")).getGrowth()).subscribe;
  return { pct: !s.rules || s.unlocked ? pctFor(s.every, g) : 0, rebate: s.rules ? Math.min(R(s).pending, g.maxRebate) : 0, freeShip: !!s.freeShip };
}

/** Record a rebate spent on an order the subscription placed. */
async function useRebate(s: Subscription, orderId: string, amount: number) {
  if (amount <= 0) return;
  const r = R(s);
  r.pending = +Math.max(0, r.pending - amount).toFixed(2);
  r.used = +(r.used + amount).toFixed(2);
  r.uses[orderId] = amount;
  note(s, `$${amount.toFixed(2)} rebate used on order ${orderId}`);
}

/** For the customer's page and admin: progress towards the discount. */
export function progress(s: Subscription, g: { monthly: number; quarterly: number; unlockMonthly: number; unlockQuarterly: number }) {
  const pct = pctFor(s.every, g);
  if (!s.rules) return { legacy: true, pct, need: 0, done: 0, unlocked: true, rebate: { earned: 0, used: 0, pending: 0, forfeited: 0 } };
  const r = R(s);
  return { legacy: false, pct, need: needFor(s, g), done: Object.keys(s.delivered ?? {}).length, unlocked: !!s.unlocked, noRebate: !!s.noRebate, rebate: { earned: r.earned, used: r.used, pending: r.pending, forfeited: r.forfeited } };
}

/** Text message and email (when we have one) next to WhatsApp, so the customer hears whichever way they read. */
async function notifyAll(s: Subscription, subject: string, text: string) {
  await (await import("@/lib/sms")).sendSms(s.customer.phone, `SuperYou: ${text}`).catch(() => null);
  if (s.customer.email) await (await import("@/lib/email")).sendEmail(s.customer.email, subject, `Hi ${s.customer.firstName},\n\n${text}\n\nThe SuperYou team`).catch(() => false);
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
      const q = await serverQuote({ items, zone: s.customer.zone, subscriptionId: s.id }).catch(() => null);
      const list = s.items.map((i) => `${i.qty}× ${i.name}`).join(", ").slice(0, 900);
      await wa.trigger("subscriptionReminder", s.customer.phone, { first_name: s.customer.firstName, items: list, next_date: prettyDate(s.nextAt), total: q ? `$${q.total.toFixed(2)}` : "", link: manageLink(s) }).catch(() => false);
      await notifyAll(s, `Your SuperYou subscription order is coming on ${prettyDate(s.nextAt)}`, `your Subscribe & save order (${list}) will be placed on ${prettyDate(s.nextAt)} and delivered within 1 to 3 days after${q ? `, total $${q.total.toFixed(2)}, paid on delivery` : ""}. Skip, change or pause it here: ${manageLink(s)}`);
      s.remindedFor = s.nextAt;
      await saveSubscription(s);
      reminded++;
    }
    if (s.nextAt <= now) {
      try {
        // Items that sold out or left the shop are skipped this time; the rest ships.
        const q = await serverQuote({ items, zone: s.customer.zone, subscriptionId: s.id });
        const ok = items.filter((i) => q.lines.find((l) => l.productId === i.productId)?.available);
        if (!ok.length) throw new Error("Everything in this subscription is out of stock");
        const o = await createOrder({ items: ok, customer: s.customer, paymentMethod: "cod", waUpdates: true, subscriptionId: s.id });
        s.orders.push(o.id);
        await notifyAll(s, `Your SuperYou subscription order ${o.id} is on its way`, `your Subscribe & save order ${o.id} (${ok.map((i) => `${i.qty}× ${s.items.find((x) => x.productId === i.productId)?.name ?? ""}`).join(", ").slice(0, 600)}) was placed today and will be delivered by ${prettyDate(addDays(now, 3))}. You pay on delivery. Manage your plan: ${manageLink(s)}`);
        await linkOrder(o.id, [s.id]);
        await useRebate(s, o.id, o.discounts?.find((d) => d.name.startsWith("Subscription rebate"))?.amount ?? 0);
        s.lastError = undefined;
        placed++;
      } catch (e) {
        s.lastError = `${now}: ${e instanceof Error ? e.message : String(e)}`;
        failed++;
      }
      s.nextAt = addMonths(s.nextAt, s.every);
      // The plan the customer chose has run its course: stop, without losing anything earned.
      if (s.endsAt && s.nextAt > s.endsAt) {
        s.status = "cancelled";
        s.log = [...(s.log ?? []), { at: new Date().toISOString(), text: `Finished: the plan ran until ${s.endsAt} as chosen` }];
      }
      await saveSubscription(s);
    }
  }
  return { reminded, placed, failed };
}

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
