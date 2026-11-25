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
