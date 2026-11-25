import "server-only";

import { db } from "@/lib/db";
import { fullName } from "@/lib/data/catalog";
import { siteUrl } from "@/lib/site-url";

// "Tell me when it's back": shoppers leave a phone (WhatsApp or text) and optionally an email on a
// sold-out product; when it's in stock again they get one message and the request is removed.
type Ask = { phone: string; via: "whatsapp" | "sms"; email?: string; name?: string; at: string };
const K = (id: string) => `stockalert:${id}`;
const ALL = "stockalert:ids";

export async function addStockAlert(productId: string, a: Ask) {
  const list = JSON.parse((await db.cmd<string | null>(["GET", K(productId)])) ?? "[]") as Ask[];
  const i = list.findIndex((x) => x.phone === a.phone);
  if (i >= 0) list[i] = a; else list.push(a);
  await db.cmd(["SET", K(productId), JSON.stringify(list.slice(-500)), "EX", String(180 * 86400)]);
  await db.cmd(["SADD", ALL, productId]);
  return list.length;
}

/** Run regularly: notify everyone waiting for a product that is back in stock. */
export async function sendStockAlerts() {
  const ids = (await db.cmd<string[] | null>(["SMEMBERS", ALL])) ?? [];
  if (!ids.length) return 0;
  const { liveProducts } = await import("@/lib/pricing");
  const live = await liveProducts();
  const wa = await import("@/lib/whatsapp");
  const { sendSms } = await import("@/lib/sms");
  const { sendEmail } = await import("@/lib/email");
  let sent = 0;
  for (const id of ids) {
    const raw = await db.cmd<string | null>(["GET", K(id)]);
    if (!raw) { await db.cmd(["SREM", ALL, id]); continue; }
    const p = live.byId.get(id);
    if (!p || !p.inStock) continue;
    const name = fullName(p.brand, p.name);
    const link = `${siteUrl()}/products/${p.slug}/`;
    for (const a of JSON.parse(raw) as Ask[]) {
      const first = a.name || "there";
      let ok = a.via === "whatsapp" && (await wa.trigger("backInStock", a.phone, { first_name: first, product: name, link }).catch(() => false));
      if (!ok) ok = await sendSms(a.phone, `SuperYou: good news, ${name} is back in stock. Order it here: ${link}`).then((r) => r.ok).catch(() => false);
      if (a.email) await sendEmail(a.email, `${name} is back in stock`, `Hi ${first},\n\nGood news: ${name} is back in stock at SuperYou.\nOrder it here: ${link}\n\nThe SuperYou team`).catch(() => false);
      sent++;
    }
    await db.cmd(["DEL", K(id)]);
    await db.cmd(["SREM", ALL, id]);
  }
  return sent;
}
