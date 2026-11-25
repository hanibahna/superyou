import "server-only";

import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { getIndex } from "@/lib/catalog";
import { getOps } from "@/lib/ops-store";
import { getOrder, updateOrder, type Order } from "@/lib/orders";
import { siteUrl } from "@/lib/site-url";

// Supplier → courier → customer, for orders of the supplier's products (NeoVitale):
// 1. Order placed: the supplier gets the barcode label + pick list (email + WhatsApp), with a "Ready for pickup" button.
// 2. Ready: the logistics company gets a pickup request (email + WhatsApp) with the courier link.
// 3. The courier scans the label (QR opens the courier page, or the barcode = order number): "Picked up" → we're told.
// 4. Delivered: the courier takes a photo of the parcel with the customer (on the page, or sends it on WhatsApp with
//    the order number) → order set to Delivered, photo kept, payment to the supplier becomes due; we're told.

const SECRET = process.env.FULFIL_SECRET || process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || "superyou-fulfil";
export type Role = "s" | "c"; // supplier, courier
export const tokenFor = (id: string, role: Role) => createHmac("sha256", SECRET).update(`${id}|${role}`).digest("base64url").slice(0, 20);
/** Purchase order number the supplier sees (never the customer's details). */
export const poNumber = (id: string) => `PO-${id.replace(/^SUP-/, "")}`;
/** The label's QR: the parcel page with no key. It shows the delivery details only on the courier's phone. */
export const labelLink = (id: string) => `${siteUrl()}/f/${encodeURIComponent(id)}/`;
/** The courier's phone is remembered with this key (cookie), set when they open any courier link. */
export const courierKey = () => createHmac("sha256", SECRET).update("courier-device").digest("base64url").slice(0, 24);
export const linkFor = (id: string, role: Role) => `${siteUrl()}/f/${encodeURIComponent(id)}/?t=${tokenFor(id, role)}&r=${role}`;
export const PAYABLES = "fulfil:payables"; // orderId → JSON { amount, at, paidAt? }
export const CASH = "fulfil:cash"; // orderId → JSON { amount, at, courier, settledAt? }: cash the courier collected for us

export type FLine = { name: string; brand: string; qty: number; sku: string; variant: string; cost: number };

/** The order's lines that the supplier ships, with their SKU and our cost. */
export async function supplierLines(o: Order, source: string): Promise<FLine[]> {
  const idx = await getIndex();
  return o.lines.filter((l) => l.productId !== "superprime").flatMap((l) => {
    const p = idx.byId.get(l.productId);
    if ((p?.source ?? "").toLowerCase() !== source.toLowerCase()) return [];
    return [{ name: l.name, brand: l.brand, qty: l.qty, sku: p?.sku ?? l.productId, variant: p?.variant ?? "", cost: Math.round((p?.cost ?? 0) * l.qty * 100) / 100 }];
  });
}

const money = (n: number) => `$${n.toFixed(2)}`;
const collectOf = (o: Order) => (o.paymentMethod === "cod" ? `${money(o.total)} cash` : "nothing (paid)");

async function tell(to: { email?: string; whatsapp?: string }, subject: string, text: string, wa?: { key: "supplierOrder" | "pickupRequest" | "opsUpdate"; vars: Record<string, string> }) {
  const sent: string[] = [];
  if (to.email && (await (await import("@/lib/email")).sendEmail(to.email, subject, text).catch(() => false))) sent.push("email");
  if (to.whatsapp && wa) {
    const ok = await (await import("@/lib/whatsapp")).trigger(wa.key, to.whatsapp, wa.vars).catch(() => false);
    if (ok) sent.push("whatsapp");
    else if ((await (await import("@/lib/sms")).sendSms(to.whatsapp, `${subject}. ${text.split("\n").find((l) => l.startsWith("http")) ?? ""}`).then((r) => r.ok).catch(() => false))) sent.push("sms");
  }
  return sent;
}

async function tellTeam(o: Order, update: string, extra = "") {
  const f = (await getOps()).fulfil;
  const { ORDERS_INBOX } = await import("@/lib/order-internal");
  const link = `${siteUrl()}/admin/orders/${o.id}/`;
  await tell({ email: f.teamEmail || ORDERS_INBOX, whatsapp: f.teamWhatsapp }, `Order ${o.id}: ${update}`, `Order ${o.id} — ${o.customer.firstName} ${o.customer.lastName}, ${o.customer.city}\n${update}${extra ? `\n${extra}` : ""}\n${link}`, { key: "opsUpdate", vars: { order_id: o.id, update, link } });
}

/** 1. New order: send the supplier its label and pick list. */
export async function sendToSupplier(o: Order, force = false) {
  const f = (await getOps()).fulfil;
  if ((!f.enabled && !o.test) || (o.fulfil && !force)) return null;
  const lines = await supplierLines(o, f.source);
  if (!lines.length) return null;
  const link = linkFor(o.id, "s");
  const items = lines.map((l) => `${l.qty} × ${l.brand} ${l.name}${l.variant ? ` (${l.variant})` : ""} [${l.sku}]`).join("\n");
  const count = lines.reduce((s, l) => s + l.qty, 0);
  // Test orders never reach the real supplier or courier: their messages go to our team instead.
  const team = { email: f.teamEmail || (await import("@/lib/order-internal")).ORDERS_INBOX, whatsapp: f.teamWhatsapp };
  const sent = await tell(
    o.test ? team : { email: f.supplierEmail, whatsapp: f.supplierWhatsapp },
    `${o.test ? "[TEST] " : ""}SuperYou purchase order ${poNumber(o.id)} — ${count} item${count === 1 ? "" : "s"} to prepare`,
    `Hello ${f.supplierName},\n\nPlease prepare SuperYou purchase order ${poNumber(o.id)}:\n${items}\n\nPrint the tracking label and stick it on the parcel, then tap "Ready for pickup":\n${link}\n\nThank you,\nSuperYou`,
    { key: "supplierOrder", vars: { order_id: poNumber(o.id), items: `${count} item${count === 1 ? "" : "s"}`, link } },
  );
  await updateOrder(o.id, { fulfil: { stage: "sent", sentAt: new Date().toISOString() } }, "fulfil", `Sent to ${f.supplierName} (${sent.join(", ") || "not sent: add the supplier's email/WhatsApp"})`);
  return sent;
}

/** 2. The supplier has packed it: ask the courier to pick it up. */
export async function markReady(id: string, by = "supplier") {
  const o = await getOrder(id);
  if (!o) throw new Error("Order not found");
  if (o.fulfil?.readyAt) return o;
  const f = (await getOps()).fulfil;
  const link = linkFor(o.id, "c");
  const to = `${o.customer.firstName} ${o.customer.lastName}, ${o.customer.city} (${o.customer.zone})`;
  const team = { email: f.teamEmail || (await import("@/lib/order-internal")).ORDERS_INBOX, whatsapp: f.teamWhatsapp };
  const sent = await tell(
    o.test ? team : { email: f.courierEmail, whatsapp: f.courierWhatsapp },
    `${o.test ? "[TEST] " : ""}Pickup: SuperYou parcel ${poNumber(o.id)} is ready`,
    `Hello ${f.courierName || ""},\n\nSuperYou parcel ${poNumber(o.id)} (order ${o.id}) is ready for pickup at:\n${f.supplierName} — ${f.supplierAddress}\n\nDeliver to: ${to}\nAddress: ${o.customer.address}\nPhone: ${o.customer.phone}\nCollect: ${collectOf(o)}\n\nScan the label's QR code (or open this link) to confirm pickup, then delivery with a photo:\n${link}\n\nThank you,\nSuperYou`,
    { key: "pickupRequest", vars: { order_id: poNumber(o.id), pickup_address: `${f.supplierName}, ${f.supplierAddress}`.slice(0, 200), deliver_to: to, collect: collectOf(o), link } },
  );
  const next = await updateOrder(o.id, { fulfil: { ...(o.fulfil ?? { stage: "sent" }), stage: "ready", readyAt: new Date().toISOString() }, ...(["pending_cod", "paid", "confirmed"].includes(o.status) ? { status: "packed" as const } : {}) }, by, `Ready for pickup — courier told (${sent.join(", ") || "not sent: add the courier's email/WhatsApp"})`);
  await tellTeam(o, `ready for pickup at ${f.supplierName}`);
  return next;
}

/** 3. The courier scanned the label and took the parcel. */
export async function markPicked(id: string, by = "courier") {
  const o = await getOrder(id);
  if (!o) throw new Error("Order not found");
  if (o.fulfil?.pickedAt) return o;
  const f = (await getOps()).fulfil;
  const shipment = { courier: "fulfil", courierName: f.courierName || "Courier", tracking: o.id, link: "", shippedAt: new Date().toISOString(), by };
  const next = await updateOrder(o.id, { shipment, status: "shipped", fulfil: { ...(o.fulfil ?? { stage: "sent" }), stage: "picked", pickedAt: new Date().toISOString() } }, by, "Picked up by the courier (label scanned)");
  await db.cmd(["SET", "fulfil:lastpicked", o.id, "EX", String(3 * 86400)]);
  await tellTeam(o, `picked up by ${f.courierName || "the courier"}`);
  return next;
}

/** 4. Delivered, with the proof-of-delivery photo: payment to the supplier becomes due. */
export async function markDelivered(id: string, pod: string, from: "page" | "whatsapp", by = "courier") {
  const o = await getOrder(id);
  if (!o) throw new Error("Order not found");
  if (o.fulfil?.deliveredAt) return o;
  const f = (await getOps()).fulfil;
  const lines = await supplierLines(o, f.source);
  const payable = Math.round(lines.reduce((s, l) => s + l.cost, 0) * 100) / 100;
  const at = new Date().toISOString();
  const next = await updateOrder(o.id, { status: "delivered", fulfil: { ...(o.fulfil ?? { stage: "sent" }), stage: "delivered", pickedAt: o.fulfil?.pickedAt ?? at, deliveredAt: at, pod, podFrom: from, payable } }, by, `Delivered — proof of delivery photo (${from})`);
  if (lines.length && !o.test) await db.cmd(["HSET", PAYABLES, o.id, JSON.stringify({ amount: payable, at, supplier: f.supplierName })]);
  if (!o.test && o.paymentMethod === "cod" && o.total > 0) await db.cmd(["HSET", CASH, o.id, JSON.stringify({ amount: o.total, at, courier: f.courierName || "Courier" })]);
  await tellTeam(o, `delivered. Payment due to ${f.supplierName}: ${money(payable)}`, `Proof of delivery: ${pod}`);
  if (lines.length && f.supplierEmail && !o.test) await (await import("@/lib/email")).sendEmail(f.supplierEmail, `SuperYou purchase order ${poNumber(o.id)} delivered — ${money(payable)} due`, `Hello ${f.supplierName},\n\nPurchase order ${poNumber(o.id)} was delivered to the customer on ${new Date(at).toLocaleDateString("en-GB", { timeZone: "Asia/Beirut" })}.\nAmount due to ${f.supplierName}: ${money(payable)}\n${lines.map((l) => `${l.qty} × ${l.brand} ${l.name} [${l.sku}] — ${money(l.cost)}`).join("\n")}\n\nThank you,\nSuperYou`).catch(() => false);
  return next;
}

export async function listPayables(): Promise<{ id: string; amount: number; at: string; supplier: string; paidAt?: string }[]> {
  const flat = (await db.cmd<string[] | null>(["HGETALL", PAYABLES])) ?? [];
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ id: flat[i], ...(JSON.parse(flat[i + 1]) as { amount: number; at: string; supplier: string; paidAt?: string }) });
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
export async function markPaid(ids: string[]) {
  const at = new Date().toISOString();
  for (const id of ids) {
    const raw = await db.cmd<string | null>(["HGET", PAYABLES, id]);
    if (!raw) continue;
    await db.cmd(["HSET", PAYABLES, id, JSON.stringify({ ...JSON.parse(raw), paidAt: at })]);
    const o = await getOrder(id);
    if (o?.fulfil) await updateOrder(id, { fulfil: { ...o.fulfil, paidAt: at } }, "admin", "Supplier paid");
  }
}

/** Keep a proof-of-delivery photo: Vercel Blob when set up, otherwise in the database (photos are shrunk first). */
export async function storePod(id: string, data: ArrayBuffer | Buffer, type = "image/jpeg") {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    return (await put(`pod/${id}.jpg`, Buffer.from(data as ArrayBuffer), { access: "public", addRandomSuffix: true, contentType: type })).url;
  }
  const buf = Buffer.from(data as ArrayBuffer);
  if (buf.length > 900_000) throw new Error("Photo too large: please retake it");
  await db.cmd(["SET", `fulfil:pod:${id}`, `${type};${buf.toString("base64")}`]);
  return `${siteUrl()}/api/fulfil/${encodeURIComponent(id)}/pod/?k=${tokenFor(id, "c").slice(0, 10)}`;
}

/** A photo sent on WhatsApp by the courier, with the order number in the caption (or the last order they picked up). */
export async function podFromWhatsApp(from: string, mediaId: string, caption: string) {
  const f = (await getOps()).fulfil;
  const { normPhone } = await import("@/lib/wa");
  if (!f.enabled || !f.courierWhatsapp || normPhone(from) !== normPhone(f.courierWhatsapp)) return false;
  const ref = caption.toUpperCase().match(/(?:SUP|PO)-[A-Z0-9]+/)?.[0];
  const id = (ref ? ref.replace(/^PO-/, "SUP-") : null) ?? (await db.cmd<string | null>(["GET", "fulfil:lastpicked"]));
  if (!id) return false;
  // Download the photo from WhatsApp and keep it.
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return false;
  const meta = (await (await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } })).json()) as { url?: string; mime_type?: string };
  if (!meta.url) return false;
  const img = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  const url = await storePod(id, await img.arrayBuffer(), meta.mime_type || "image/jpeg");
  await markDelivered(id, url, "whatsapp", `courier ${from}`);
  return true;
}

export async function listCash(): Promise<{ id: string; amount: number; at: string; courier: string; settledAt?: string }[]> {
  const flat = (await db.cmd<string[] | null>(["HGETALL", CASH])) ?? [];
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push({ id: flat[i], ...(JSON.parse(flat[i + 1]) as { amount: number; at: string; courier: string; settledAt?: string }) });
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
export async function settleCash(ids: string[]) {
  const at = new Date().toISOString();
  for (const id of ids) {
    const raw = await db.cmd<string | null>(["HGET", CASH, id]);
    if (raw) await db.cmd(["HSET", CASH, id, JSON.stringify({ ...JSON.parse(raw), settledAt: at })]);
  }
}
