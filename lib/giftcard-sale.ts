import "server-only";

// Gift cards bought on the site. The buyer pays like any order (card, Whish or cash);
// once the order is Paid (or Delivered, for cash), the card is created and sent to the recipient.

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { issueGiftCard } from "@/lib/giftcards";
import { getOps } from "@/lib/ops-store";
import { getOrder, saveOrder, type Order, type OrderStatus } from "@/lib/orders";
import { siteUrl } from "@/lib/site-url";

export const GIFT_AMOUNTS = [25, 50, 100, 150, 200];

export const buySchema = z.object({
  amount: z.number().min(10).max(1000),
  recipient: z.string().min(1).max(60),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  message: z.string().max(300).optional(),
  buyer: z.object({ firstName: z.string().min(1).max(60), lastName: z.string().min(1).max(60), phone: z.string().min(6).max(20), email: z.string().email().optional().or(z.literal("")) }),
  paymentMethod: z.enum(["cod", "card", "whish"]),
}).refine((d) => d.phone || d.email, { message: "Add the recipient's mobile or email so we can send the card" });

export async function createGiftCardOrder(d: z.infer<typeof buySchema>): Promise<Order> {
  const ops = await getOps();
  if (!ops.giftCards.enabled) throw new Error("Gift cards aren't available right now.");
  const amount = +d.amount.toFixed(2);
  const status: OrderStatus = d.paymentMethod === "cod" ? "pending_cod" : "awaiting_payment";
  const order: Order = {
    id: `GIFT-${Date.now().toString(36).toUpperCase()}`,
    accessToken: randomBytes(16).toString("hex"),
    createdAt: new Date().toISOString(),
    status,
    paymentMethod: d.paymentMethod,
    lines: [{ productId: "gift-card", name: `Gift card for ${d.recipient}`, brand: "SuperYou", unitPrice: amount, qty: 1, lineTotal: amount }],
    subtotal: amount,
    delivery: 0,
    total: amount,
    currency: "USD",
    customer: { ...d.buyer, zone: "Gift card", city: "Digital", address: "Sent by WhatsApp / email", notes: d.paymentMethod === "cod" ? "Gift card: collect cash, then set the order to Delivered to send the card." : undefined },
    giftCardPurchase: { amount, recipient: d.recipient, phone: d.phone || "", email: d.email || "", message: d.message ?? "", from: `${d.buyer.firstName} ${d.buyer.lastName}` },
    history: [{ at: new Date().toISOString(), status, by: "customer" }],
  };
  await saveOrder(order);
  const wa = await import("@/lib/whatsapp");
  await wa.upsertContact({ phone: d.buyer.phone, name: order.giftCardPurchase!.from, email: d.buyer.email || undefined, source: "checkout" }).catch(() => {});
  await wa.trigger("orderPlaced", d.buyer.phone, { first_name: d.buyer.firstName, name: order.giftCardPurchase!.from, order_id: order.id, total: `$${amount.toFixed(2)}`, items: order.lines[0].name, link: `${siteUrl()}/order/?id=${order.id}&t=${order.accessToken}` });
  return order;
}

/** Create the card and send it (once per order). */
export async function deliverGiftCard(orderId: string) {
  const o = await getOrder(orderId);
  const p = o?.giftCardPurchase;
  if (!o || !p || p.code) return;
  const ops = await getOps();
  const card = await issueGiftCard({ amount: p.amount, recipient: p.recipient, phone: p.phone, note: `Bought online by ${p.from} (${o.id})`, validMonths: ops.giftCards.validMonths, by: "online sale" });
  await saveOrder({ ...o, giftCardPurchase: { ...p, code: card.code, sentAt: new Date().toISOString() } });
  const vars = { first_name: p.recipient.split(" ")[0], from: p.from, amount: `$${p.amount.toFixed(2)}`, code: card.code, message: p.message || "Enjoy!", link: siteUrl() };
  if (p.phone) await (await import("@/lib/whatsapp")).trigger("giftCardSent", p.phone, vars);
  if (p.email)
    await sendEmail(
      p.email,
      `${p.from} sent you a SuperYou gift card`,
      `Hi ${vars.first_name},\n\n${p.from} sent you a SuperYou gift card worth ${vars.amount}.${p.message ? `\n\n“${p.message}”` : ""}\n\nYour code: ${card.code}\n\nUse it at checkout on ${siteUrl()} — type the code in the discount box.${card.expiresAt ? ` Valid until ${new Date(card.expiresAt).toLocaleDateString("en-GB")}.` : ""}\n\nSuperYou`,
    ).catch(() => false);
}
