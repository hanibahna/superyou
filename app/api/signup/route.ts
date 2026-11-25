import { limited } from "@/lib/ratelimit";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getGrowth, spin, welcomeCode } from "@/lib/growth-store";
import { normPhone } from "@/lib/wa";

// Pop-up sign-up: saves the subscriber and returns a personal one-time discount code.
export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "signup", 20);
  if (tooMany) return tooMany;
  const parsed = z.object({ email: z.string().email().max(200).optional().or(z.literal("")), phone: z.string().max(30).optional().or(z.literal("")), via: z.enum(["whatsapp", "sms"]).default("whatsapp"), source: z.enum(["popup", "cart"]).default("popup") }).safeParse(await req.json().catch(() => null));
  // The code goes to a phone (WhatsApp or text message), one per number; the email only joins the mailing list.
  if (!parsed.success || !parsed.data.phone) return NextResponse.json({ error: "Please enter your mobile number" }, { status: 400 });
  const g = await getGrowth();
  if (!g.popup.enabled) return NextResponse.json({ error: "Sign-ups are closed" }, { status: 400 });
  const email = parsed.data.email?.toLowerCase() || "";
  const phone = parsed.data.phone ? normPhone(parsed.data.phone) : "";
  if (!phone) return NextResponse.json({ error: "Please check the mobile number" }, { status: 400 });

  // Offer: always the spin-to-win wheel (pop-up and cart exit alike).
  let percent = g.popup.percent;
  let index: number | undefined;
  if (g.popup.wheel.length >= 2) {
    const s = spin(g);
    (percent = s.slice.percent), (index = s.index);
  }
  const { voucher, isNew } = await welcomeCode(phone, g, percent);
  if (!voucher) return NextResponse.json({ error: "You've already used your welcome code — thanks for being with us!" }, { status: 400 });

  if (email) await db.cmd(["ZADD", "subscribers", Date.now(), email]);
  const wa = await import("@/lib/whatsapp");
  await wa.upsertContact({ phone, email: email || undefined, source: "popup", offers: true });
  // Deliver the code by the channel chosen (WhatsApp first falls back to a text message).
  let delivered: "whatsapp" | "sms" | null = null;
  const text = `SuperYou: your code ${voucher.code} gives ${voucher.percent}% off your first order, until ${voucher.expires.slice(0, 10)}.`;
  if (parsed.data.via === "whatsapp" && (await wa.trigger("welcomeCode", phone, { first_name: "there", code: voucher.code, percent: String(voucher.percent), days: String(g.popup.validDays) }).catch(() => false))) delivered = "whatsapp";
  if (!delivered && (await (await import("@/lib/sms")).sendSms(phone, text).then((r) => r.ok).catch(() => false))) delivered = "sms";
  if (email && isNew) await sendEmail(email, "Welcome to SuperYou", "Thanks for joining SuperYou! You'll get pharmacist tips, early access to sales and our offers. Your welcome code was sent to your phone.").catch(() => false);
  const idx = isNew ? index : g.popup.wheel.findIndex((w) => w.percent === voucher.percent);
  // Shown on screen only when no message could be sent (messaging not connected yet).
  return NextResponse.json({ ok: true, percent: voucher.percent, expires: voucher.expires, index: idx, delivered, ...(delivered ? {} : { code: voucher.code }) });
}
