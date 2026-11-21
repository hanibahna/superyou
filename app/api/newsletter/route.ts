import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

// Newsletter sign-ups (listed and exported in Admin → Subscribers).
export async function POST(req: NextRequest) {
  const parsed = z.object({ email: z.string().email().max(200).or(z.literal("")).optional(), phone: z.string().max(30).optional() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.email && !parsed.data.phone)) return NextResponse.json({ error: "Please enter your email or WhatsApp number" }, { status: 400 });
  if (parsed.data.email) await db.cmd(["ZADD", "subscribers", Date.now(), parsed.data.email.toLowerCase()]);
  if (parsed.data.phone) {
    const wa = await import("@/lib/whatsapp");
    const res = await wa.upsertContact({ phone: parsed.data.phone, email: parsed.data.email, source: "newsletter", offers: true });
    if (!res) return NextResponse.json({ error: "Please check the WhatsApp number" }, { status: 400 });
    if (res.newOptIn) await wa.trigger("welcomeOptIn", res.contact.phone, { first_name: res.contact.name.split(" ")[0] || "there" });
  }
  return NextResponse.json({ ok: true });
}
