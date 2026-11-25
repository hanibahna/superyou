import "server-only";

import { db } from "@/lib/db";
import { normPhone } from "@/lib/wa";

// Bulk buy daily limit: discounted units per product per customer (phone) per Beirut day.
const day = () => new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);
const K = (phone: string, productId: string) => `bulk:${normPhone(phone)}:${day()}:${productId}`;

export async function getBulkUsed(phone: string, productId: string) {
  if (!normPhone(phone)) return 0;
  return Number((await db.cmd<string | null>(["GET", K(phone, productId)]).catch(() => null)) ?? 0);
}

export async function addBulkUsed(phone: string, productId: string, units: number) {
  if (!normPhone(phone) || units <= 0) return;
  await db.cmd(["INCRBY", K(phone, productId), units]);
  await db.cmd(["EXPIRE", K(phone, productId), 2 * 86400]);
}

// Authorized bulk buyers: companies or people (by phone) the admin approves for their own
// bulk/wholesale price. They get their % from 1 (or their minimum) unit, with their own daily cap
// (0 = no cap), still never below cost + the minimum margin.
export type BulkBuyer = { phone: string; name: string; company: string; pct: number; maxUnits: number; minQty: number; notes: string; active: boolean; since: string; enquiry?: string };
const BUYERS = "bulk:buyers";

export async function getBulkBuyer(phone?: string): Promise<BulkBuyer | null> {
  const p = phone ? normPhone(phone) : "";
  if (!p) return null;
  const raw = await db.cmd<string | null>(["HGET", BUYERS, p]).catch(() => null);
  const b = raw ? (JSON.parse(raw) as BulkBuyer) : null;
  return b?.active ? b : null;
}
export async function listBulkBuyers(): Promise<BulkBuyer[]> {
  const flat = (await db.cmd<string[] | null>(["HGETALL", BUYERS])) ?? [];
  const out: BulkBuyer[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push(JSON.parse(flat[i + 1]));
  return out.sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name));
}
export async function saveBulkBuyer(b: Omit<BulkBuyer, "since" | "phone"> & { phone: string; since?: string }) {
  const phone = normPhone(b.phone);
  if (!phone) throw new Error("Please check the mobile number");
  const old = await db.cmd<string | null>(["HGET", BUYERS, phone]);
  const v: BulkBuyer = { ...b, phone, since: b.since ?? (old ? JSON.parse(old).since : new Date().toISOString()) };
  await db.cmd(["HSET", BUYERS, phone, JSON.stringify(v)]);
  return v;
}
export async function deleteBulkBuyer(phone: string) {
  const p = normPhone(phone);
  if (p) await db.cmd(["HDEL", BUYERS, p]);
}
