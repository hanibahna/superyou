import "server-only";

import { z } from "zod";
import { db } from "@/lib/db";
import type { Order } from "@/lib/orders";

// Influencer & partner program: each influencer has a personal code (also a link: /?ref=CODE).
// Followers get a % off; the influencer earns a commission on what those orders are worth after
// discounts (delivery excluded). Clicks, orders and commission are tracked; payouts are marked in
// Admin → Referrals & influencers.
export type Influencer = {
  code: string; // e.g. RANA10 (uppercase)
  name: string;
  handle: string; // @instagram / TikTok
  platform: string;
  phone: string;
  email: string;
  percentOff: number; // follower discount
  commission: number; // % of net sales
  minSubtotal: number;
  active: boolean;
  notes: string;
  createdAt: string;
  paid: number; // total paid out so far
};
export type InfluencerSale = { orderId: string; at: string; net: number; commission: number };

export const influencerSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,20}$/, "Code: 3–20 letters, numbers or -"),
  name: z.string().trim().min(1).max(80),
  handle: z.string().max(80).default(""),
  platform: z.string().max(40).default("Instagram"),
  phone: z.string().max(30).default(""),
  email: z.string().max(120).default(""),
  percentOff: z.coerce.number().min(0).max(50),
  commission: z.coerce.number().min(0).max(50),
  minSubtotal: z.coerce.number().min(0).max(10000).default(0),
  active: z.boolean(),
  notes: z.string().max(500).default(""),
});

const K = (c: string) => `inf:${c.toUpperCase()}`;
const LIST = "inf:list";

export async function getInfluencer(code: string): Promise<Influencer | null> {
  if (!/^[A-Z0-9-]{3,20}$/i.test(code.trim())) return null;
  const raw = await db.cmd<string | null>(["GET", K(code.trim())]).catch(() => null);
  return raw ? (JSON.parse(raw) as Influencer) : null;
}
export async function saveInfluencer(i: Influencer) {
  await db.cmd(["SET", K(i.code), JSON.stringify(i)]);
  await db.cmd(["SADD", LIST, i.code]);
}
export async function deleteInfluencer(code: string) {
  await db.cmd(["DEL", K(code)]);
  await db.cmd(["SREM", LIST, code.toUpperCase()]);
}
export async function listInfluencers(): Promise<Influencer[]> {
  const codes = await db.cmd<string[]>(["SMEMBERS", LIST]).catch(() => [] as string[]);
  const all = await Promise.all(codes.map(getInfluencer));
  return all.filter((x): x is Influencer => !!x).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function trackClick(code: string) {
  const i = await getInfluencer(code);
  if (!i?.active) return false;
  await db.cmd(["INCR", `inf:clicks:${i.code}`]);
  return true;
}
export async function influencerStats(code: string) {
  const [clicks, rows] = await Promise.all([
    db.cmd<string | null>(["GET", `inf:clicks:${code}`]).catch(() => null),
    db.cmd<string[]>(["LRANGE", `inf:sales:${code}`, "0", "999"]).catch(() => [] as string[]),
  ]);
  return { clicks: Number(clicks) || 0, sales: rows.map((r) => JSON.parse(r) as InfluencerSale) };
}

/** After checkout: credit the influencer whose code the order used. */
export async function creditOrder(order: Order) {
  if (!order.code) return;
  const i = await getInfluencer(order.code);
  if (!i) return;
  const net = +Math.max(0, order.subtotal - (order.discount ?? 0)).toFixed(2);
  const sale: InfluencerSale = { orderId: order.id, at: order.createdAt, net, commission: +((net * i.commission) / 100).toFixed(2) };
  await db.cmd(["LPUSH", `inf:sales:${i.code}`, JSON.stringify(sale)]);
}
