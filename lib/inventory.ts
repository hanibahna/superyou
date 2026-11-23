import { fullName } from "@/lib/data/catalog";
import "server-only";

// Stock counts: taken off when an order is placed, put back when it's cancelled or a refund
// restocks items, adjusted by hand in Admin → Inventory. Products without a count are "not tracked".

import { getProductsDetailed } from "@/lib/catalog";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getOps } from "@/lib/ops-store";
import { getSettings } from "@/lib/site-store";
import { siteUrl } from "@/lib/site-url";

export type StockChange = { productId: string; delta?: number; set?: number };
export type StockMove = { at: number; productId: string; name: string; from: number; to: number; reason: string; by: string };

/** Apply stock changes to tracked products. Returns the moves made. Sends a low-stock email when a product drops to the alert level. */
export async function adjustStock(changes: StockChange[], reason: string, by = "system"): Promise<StockMove[]> {
  const merged = new Map<string, StockChange>();
  for (const c of changes) {
    const m = merged.get(c.productId) ?? { productId: c.productId };
    if (c.set !== undefined) (m.set = c.set), (m.delta = undefined);
    else if (c.delta) m.set !== undefined ? (m.set += c.delta) : (m.delta = (m.delta ?? 0) + c.delta);
    merged.set(c.productId, m);
  }
  if (!merged.size) return [];
  const products = await getProductsDetailed([...merged.keys()]);
  const ops = await getOps();
  const moves: StockMove[] = [];
  const changed = [];
  const low: StockMove[] = [];
  for (const p of products) {
    const c = merged.get(p.id)!;
    if (c.set === undefined && p.stock === undefined) continue; // not tracked
    const from = p.stock ?? 0;
    const to = Math.max(0, Math.round(c.set ?? from + (c.delta ?? 0)));
    if (to === from && p.stock !== undefined) continue;
    changed.push({ ...p, stock: to });
    const mv = { at: Date.now(), productId: p.id, name: `${fullName(p.brand, p.name)}${p.variant ? ` – ${p.variant}` : ""}`, from, to, reason, by };
    moves.push(mv);
    if (to < from && to <= ops.stock.lowAt && from > ops.stock.lowAt) low.push(mv);
  }
  if (!changed.length) return [];
  const { saveProducts } = await import("@/lib/catalog");
  await saveProducts(changed);
  await db.pipeline([
    ...moves.map((m) => ["ZADD", "stock:log", m.at, JSON.stringify({ ...m, r: Math.random().toString(36).slice(2, 7) })]),
    ["ZREMRANGEBYRANK", "stock:log", 0, -5001],
  ]);
  if (low.length) await lowStockEmail(low, ops.stock.alertEmail).catch(() => {});
  return moves;
}

async function lowStockEmail(moves: StockMove[], to: string) {
  const s = await getSettings();
  const email = to || s.store.email;
  if (!email || /example\.com$/i.test(email)) return;
  const lines = moves.map((m) => `• ${m.name}: ${m.to === 0 ? "SOLD OUT" : `${m.to} left`}`).join("\n");
  await sendEmail(email, `Low stock: ${moves.length} product${moves.length > 1 ? "s" : ""}`, `These products are running low:\n\n${lines}\n\nUpdate counts: ${siteUrl()}/admin/inventory/`);
}

export async function stockLog(limit = 200, productId?: string): Promise<StockMove[]> {
  const raw = await db.cmd<string[]>(["ZREVRANGE", "stock:log", 0, productId ? 4999 : limit - 1]);
  const all = raw.map((r) => JSON.parse(r) as StockMove);
  return (productId ? all.filter((m) => m.productId === productId) : all).slice(0, limit);
}
