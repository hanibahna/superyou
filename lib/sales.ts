import "server-only";

// Sales reporting from the orders database.

import { db } from "@/lib/db";
import { orderValue, refunded, type Order } from "@/lib/orders";

/** Orders that count as sales (not cancelled, failed or still waiting for an online payment). */
export const counts = (o: Order) => !["cancelled", "payment_failed", "awaiting_payment"].includes(o.status) && !o.giftCardPurchase;
/** Gift cards sold online are money in advance: counted when they're spent, shown separately. */
const giftSale = (o: Order) => !!o.giftCardPurchase && !["cancelled", "payment_failed", "awaiting_payment"].includes(o.status);

export async function ordersBetween(from: number, to: number): Promise<Order[]> {
  const ids = await db.cmd<string[]>(["ZRANGEBYSCORE", "orders", from, to]);
  const out: Order[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    const raws = await db.pipeline(ids.slice(i, i + 500).map((id) => ["GET", `order:${id}`]));
    for (const r of raws) if (r) out.push(JSON.parse(r as string) as Order);
  }
  return out;
}

const r2 = (n: number) => +n.toFixed(2);
const beirutDay = (iso: string) => new Date(Date.parse(iso) + 2 * 3600_000).toISOString().slice(0, 10);

function summarise(orders: Order[]) {
  const live = orders.filter(counts);
  const gross = live.reduce((s, o) => s + o.subtotal, 0);
  const discounts = live.reduce((s, o) => s + (o.discount ?? 0), 0);
  const delivery = live.reduce((s, o) => s + o.delivery, 0);
  const refunds = live.reduce((s, o) => s + refunded(o), 0); // refunds on cancelled orders aren't sales either
  const net = live.reduce((s, o) => s + orderValue(o), 0) - refunds;
  const units = live.reduce((s, o) => s + o.lines.filter((l) => !l.gift).reduce((a, l) => a + l.qty, 0), 0);
  return { orders: live.length, gross: r2(gross), discounts: r2(discounts), delivery: r2(delivery), refunds: r2(refunds), net: r2(net), units, aov: live.length ? r2(net / live.length) : 0 };
}

export async function salesReport(days: number) {
  const now = Date.now();
  const from = now - days * 864e5;
  const [cur, prev] = await Promise.all([ordersBetween(from, now), ordersBetween(from - days * 864e5, from - 1)]);
  const live = cur.filter(counts);

  // Day by day (Beirut time).
  const byDay = new Map<string, { net: number; orders: number }>();
  for (let t = from; t <= now; t += 864e5) byDay.set(beirutDay(new Date(t).toISOString()), { net: 0, orders: 0 });
  for (const o of live) {
    const d = byDay.get(beirutDay(o.createdAt)) ?? { net: 0, orders: 0 };
    d.net += orderValue(o) - refunded(o);
    d.orders++;
    byDay.set(beirutDay(o.createdAt), d);
  }

  const group = <K extends string>(keyOf: (o: Order) => K) => {
    const m = new Map<K, { key: K; orders: number; value: number }>();
    for (const o of live) {
      const k = keyOf(o);
      const x = m.get(k) ?? { key: k, orders: 0, value: 0 };
      x.orders++;
      x.value = r2(x.value + orderValue(o) - refunded(o));
      m.set(k, x);
    }
    return [...m.values()].sort((a, b) => b.value - a.value);
  };

  const products = new Map<string, { productId: string; name: string; brand: string; units: number; value: number }>();
  const brands = new Map<string, { brand: string; units: number; value: number }>();
  for (const o of live)
    for (const l of o.lines) {
      if (l.gift) continue;
      const p = products.get(l.productId) ?? { productId: l.productId, name: l.name, brand: l.brand, units: 0, value: 0 };
      p.units += l.qty;
      p.value = r2(p.value + l.lineTotal);
      products.set(l.productId, p);
      const b = brands.get(l.brand) ?? { brand: l.brand, units: 0, value: 0 };
      b.units += l.qty;
      b.value = r2(b.value + l.lineTotal);
      brands.set(l.brand, b);
    }

  // New vs returning customers (by mobile number, across all orders ever).
  const phones = [...new Set(live.map((o) => o.customer.phone.replace(/\D/g, "")))];
  const { normPhone } = await import("@/lib/wa");
  const counts2 = phones.length ? await db.pipeline(phones.map((p) => ["ZCARD", `orders:by:${normPhone(p)}`])) : [];
  const returning = counts2.filter((n) => Number(n) > 1).length;

  const statuses = new Map<string, number>();
  for (const o of cur) statuses.set(o.status, (statuses.get(o.status) ?? 0) + 1);

  return {
    days,
    now: summarise(cur),
    before: summarise(prev),
    daily: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, net: r2(v.net), orders: v.orders })),
    topProducts: [...products.values()].sort((a, b) => b.value - a.value).slice(0, 15),
    topBrands: [...brands.values()].sort((a, b) => b.value - a.value).slice(0, 10),
    byArea: group((o) => o.customer.zone || "—").slice(0, 12),
    byPayment: group((o) => o.paymentMethod),
    customers: { total: phones.length, returning, new: phones.length - returning },
    giftCardsUsed: r2(live.reduce((s, o) => s + (o.giftCard?.amount ?? 0), 0)),
    giftCardsSold: { count: cur.filter(giftSale).length, value: r2(cur.filter(giftSale).reduce((s, o) => s + o.total, 0)) },
    statuses: [...statuses.entries()].sort((a, b) => b[1] - a[1]),
    orders: cur,
  };
}
