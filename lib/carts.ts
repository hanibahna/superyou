import "server-only";

// Abandoned carts: saved when a shopper types their mobile number at checkout. If they don't
// finish, and they agreed to WhatsApp offers, they get one reminder with a link that refills
// their bag. Staff can also see every open cart in Admin → Abandoned carts.

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getOps } from "@/lib/ops-store";
import { siteUrl } from "@/lib/site-url";
import { normPhone } from "@/lib/wa";

export type SavedCart = {
  phone: string;
  name: string;
  items: { productId: string; qty: number; name: string; price: number }[];
  value: number;
  code?: string;
  consent: boolean; // agreed to WhatsApp offers
  lang: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  status: "open" | "reminded" | "recovered";
  remindedAt?: string;
  orderId?: string;
};

export async function saveCart(input: { phone: string; name: string; items: { productId: string; qty: number }[]; code?: string; consent: boolean; lang: string }) {
  const phone = normPhone(input.phone);
  if (!phone || !input.items.length) return null;
  const { liveProducts } = await import("@/lib/pricing");
  const live = await liveProducts();
  const items = input.items.map((i) => ({ ...i, p: live.byId.get(i.productId) })).filter((i) => i.p).map((i) => ({ productId: i.productId, qty: i.qty, name: `${i.p!.brand} ${i.p!.name}`, price: i.p!.price }));
  if (!items.length) return null;
  const prev = await getCart(phone);
  const now = new Date().toISOString();
  const cart: SavedCart = {
    phone, name: input.name.slice(0, 80), items, value: +items.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2), code: input.code, consent: input.consent, lang: input.lang,
    token: prev?.status === "open" ? prev.token : randomBytes(9).toString("base64url"), createdAt: prev?.status === "open" ? prev.createdAt : now, updatedAt: now,
    status: "open",
  };
  if (prev && prev.status !== "open") await db.cmd(["DEL", `cart:tok:${prev.token}`]);
  await db.pipeline([["SET", `cart:${phone}`, JSON.stringify(cart)], ["SET", `cart:tok:${cart.token}`, phone], ["ZADD", "carts", Date.now(), phone], ["ZADD", "carts:due", Date.now(), phone]]);
  if (input.consent) {
    const wa = await import("@/lib/whatsapp");
    await wa.upsertContact({ phone, name: cart.name, source: "checkout", offers: true }).catch(() => {});
  }
  return cart;
}

export async function getCart(phone: string): Promise<SavedCart | null> {
  const raw = await db.cmd<string | null>(["GET", `cart:${normPhone(phone)}`]);
  return raw ? (JSON.parse(raw) as SavedCart) : null;
}

/** The shopper ordered: a reminded cart counts as recovered, any other saved cart is removed. */
export async function cartConverted(phone: string, orderId: string) {
  const c = await getCart(phone);
  if (!c) return;
  if (c.status === "reminded") {
    await db.cmd(["SET", `cart:${c.phone}`, JSON.stringify({ ...c, status: "recovered", orderId, updatedAt: new Date().toISOString() })]);
  } else if (c.status === "open") {
    await db.pipeline([["DEL", `cart:${c.phone}`], ["DEL", `cart:tok:${c.token}`], ["ZREM", "carts", c.phone], ["ZREM", "carts:due", c.phone]]);
  }
  await db.cmd(["ZREM", "carts:due", c.phone]);
}

export async function cartByToken(token: string) {
  const phone = await db.cmd<string | null>(["GET", `cart:tok:${token.slice(0, 40)}`]);
  return phone ? getCart(phone) : null;
}

export async function listCarts(limit = 300): Promise<SavedCart[]> {
  const phones = await db.cmd<string[]>(["ZREVRANGE", "carts", 0, limit - 1]);
  const raws = phones.length ? await db.pipeline(phones.map((p) => ["GET", `cart:${p}`])) : [];
  return raws.filter(Boolean).map((r) => JSON.parse(r as string) as SavedCart);
}

export async function deleteCart(phone: string) {
  const c = await getCart(phone);
  if (c) await db.pipeline([["DEL", `cart:${c.phone}`], ["DEL", `cart:tok:${c.token}`], ["ZREM", "carts", c.phone], ["ZREM", "carts:due", c.phone]]);
}

export const restoreLink = (c: SavedCart) => `${siteUrl()}${c.lang && c.lang !== "en" ? `/${c.lang}` : ""}/cart/?restore=${c.token}`;

/** Send due reminders. Runs from the daily job and, at most every 10 minutes, after shop activity. */
export async function sweepCarts(force = false) {
  const now = Date.now();
  if (!force) {
    const last = Number((await db.cmd<string | null>(["GET", "carts:sweep"])) ?? 0);
    if (now - last < 10 * 60_000) return 0;
  }
  await db.cmd(["SET", "carts:sweep", String(now)]);
  const ops = await getOps();
  if (!ops.carts.enabled) return 0;
  const phones = await db.cmd<string[]>(["ZRANGEBYSCORE", "carts:due", now - ops.carts.maxAgeHours * 3600_000, now - ops.carts.afterHours * 3600_000, "LIMIT", 0, 100]);
  let sent = 0;
  const wa = await import("@/lib/whatsapp");
  for (const p of phones) {
    await db.cmd(["ZREM", "carts:due", p]);
    const c = await getCart(p);
    if (!c || c.status !== "open" || !c.consent) continue;
    {
      await wa.trigger("cartReminder", c.phone, {
        first_name: c.name.split(" ")[0] || "there", items: c.items.map((i) => `${i.qty}× ${i.name}`).join(", ").slice(0, 500), total: `$${c.value.toFixed(2)}`, link: restoreLink(c),
      });
      sent++;
    }
    await db.cmd(["SET", `cart:${c.phone}`, JSON.stringify({ ...c, status: "reminded", remindedAt: new Date().toISOString() })]);
  }
  // Forget carts older than 30 days.
  const stale = await db.cmd<string[]>(["ZRANGEBYSCORE", "carts:due", "-inf", now - ops.carts.maxAgeHours * 3600_000, "LIMIT", 0, 500]);
  if (stale.length) await db.cmd(["ZREM", "carts:due", ...stale]);
  const old = await db.cmd<string[]>(["ZRANGEBYSCORE", "carts", "-inf", now - 30 * 864e5, "LIMIT", 0, 200]);
  for (const p of old) await deleteCart(p);
  return sent;
}
