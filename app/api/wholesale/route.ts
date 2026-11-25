import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { limited } from "@/lib/ratelimit";
import { addWholesale } from "@/lib/wholesale";

// Wholesale enquiry form: saved for Admin › Wholesale, emailed to the orders inbox and sent to the team's WhatsApp.
export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "wholesale", 10);
  if (tooMany) return tooMany;
  const t = (n: number) => z.string().trim().max(n);
  const b = z.object({
    business: t(120).min(2), type: t(60), contact: t(80).min(2), phone: t(30).min(6), email: z.string().trim().email().max(160).or(z.literal("")),
    city: t(80), volume: t(60), categories: z.array(t(40)).max(12).default([]), brands: t(500), message: t(1500),
  }).safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "Please fill in the business name, your name and a phone number." }, { status: 400 });
  const w = await addWholesale(b.data);
  const text = `Wholesale enquiry ${w.id}\n${w.business} (${w.type || "type not given"}), ${w.city}\nContact: ${w.contact} · ${w.phone}${w.email ? ` · ${w.email}` : ""}\nMonthly volume: ${w.volume || "not given"}\nCategories: ${w.categories.join(", ") || "not given"}\nBrands: ${w.brands || "not given"}\n\n${w.message}`;
  const { ORDERS_INBOX } = await import("@/lib/order-internal");
  await (await import("@/lib/email")).sendEmail(ORDERS_INBOX, `Wholesale enquiry: ${w.business}`, text).catch(() => false);
  const team = (await (await import("@/lib/ops-store")).getOps()).fulfil.teamWhatsapp;
  if (team) await (await import("@/lib/whatsapp")).trigger("opsUpdate", team, { order_id: w.id, update: `new wholesale enquiry from ${w.business}, ${w.contact} ${w.phone}`, link: "https://www.shopsuperyou.com/admin/wholesale/" }).catch(() => false);
  return NextResponse.json({ ok: true, id: w.id });
}
