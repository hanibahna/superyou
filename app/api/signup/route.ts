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
  const parsed = z.object({ email: z.string().email().max(200).optional().or(z.literal("")), phone: z.string().max(30).optional().or(z.literal("")), source: z.enum(["popup", "cart"]).default("popup") }).safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.email && !parsed.data.phone)) return NextResponse.json({ error: "Please enter your email or WhatsApp number" }, { status: 400 });
  const g = await getGrowth();
  if (!g.popup.enabled) return NextResponse.json({ error: "Sign-ups are closed" }, { status: 400 });
  const email = parsed.data.email?.toLowerCase() || "";
  const phone = parsed.data.phone ? normPhone(parsed.data.phone) : "";
  if (parsed.data.phone && !phone) return NextResponse.json({ error: "Please check the WhatsApp number" }, { status: 400 });

  // Offer: wheel slice, cart-exit percent or the classic welcome percent.
  let percent = g.popup.percent;
  let index: number | undefined;
  if (parsed.data.source === "cart" && g.popup.cartExitPercent > 0) percent = g.popup.cartExitPercent;
  else if (g.popup.mode === "wheel") {
    const s = spin(g);
    (percent = s.slice.percent), (index = s.index);
  }
  const { voucher, isNew } = await welcomeCode(phone || email, g, percent);
  if (!voucher) return NextResponse.json({ error: "You've already used your welcome code — thanks for being with us!" }, { status: 400 });

  if (email) await db.cmd(["ZADD", "subscribers", Date.now(), email]);
  if (phone) {
    const wa = await import("@/lib/whatsapp");
    await wa.upsertContact({ phone, email: email || undefined, source: "popup", offers: true });
    if (isNew) await wa.trigger("welcomeCode", phone, { first_name: "there", code: voucher.code, percent: String(voucher.percent), days: String(g.popup.validDays) });
  }
  if (email && isNew)
    await sendEmail(email, `Your ${voucher.percent}% welcome code`, `Welcome to SuperYou!\n\nYour code: ${voucher.code}\nIt gives ${voucher.percent}% off your first order and is valid until ${voucher.expires.slice(0, 10)}.\n\nSuperYou`).catch(() => false);
  return NextResponse.json({ ok: true, code: voucher.code, percent: voucher.percent, expires: voucher.expires, index: isNew ? index : g.popup.wheel.findIndex((w) => w.percent === voucher.percent) });
}
