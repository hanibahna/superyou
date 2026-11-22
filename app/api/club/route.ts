import { limited } from "@/lib/ratelimit";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { tierFor } from "@/lib/growth";
import { getGrowth, getMember, joinClub, orderIdsByPhone, yearSpend } from "@/lib/growth-store";
import { getOrder, publicOrder } from "@/lib/orders";
import { addressListSchema } from "@/lib/addresses";
import { getAddresses, saveAddresses } from "@/lib/address-store";

// Member lookup: phone + one of their order numbers (light check so balances aren't public).
export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone") ?? "";
  const orderId = (req.nextUrl.searchParams.get("order") ?? "").trim().toUpperCase();
  const ids = phone ? await orderIdsByPhone(phone) : [];
  if (!ids.includes(orderId)) return NextResponse.json({ error: "We couldn't match that phone number and order number" }, { status: 404 });
  const [g, m, orders] = await Promise.all([getGrowth(), getMember(phone), Promise.all(ids.slice(0, 10).map(getOrder))]);
  const spend = m ? yearSpend(m) : 0;
  const t = tierFor(g.club.tiers, spend);
  return NextResponse.json({
    member: m ? { name: m.name, points: m.points, lifetimePoints: m.lifetimePoints, spend, tier: t.tier.name, next: t.next?.name, toNext: t.toNext, rewards: m.rewards.slice(-10), birthday: m.birthday ?? "", ref: m.ref ?? "", history: (m.history ?? []).slice(-50).reverse() } : null,
    orders: orders.filter((o) => !!o).map((o) => publicOrder(o!)),
  });
}

export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "club", 30);
  if (tooMany) return tooMany;
  const parsed = z.object({ phone: z.string().min(6).max(30), name: z.string().min(1).max(80), email: z.string().email().optional().or(z.literal("")), birthday: z.string().regex(/^\d{2}-\d{2}$/).optional().or(z.literal("")), addresses: addressListSchema.optional().catch(undefined) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please enter your name and WhatsApp number" }, { status: 400 });
  const g = await getGrowth();
  if (!g.club.enabled) return NextResponse.json({ error: "The club is closed" }, { status: 400 });
  const { addresses, ...join } = parsed.data;
  const m = await joinClub({ ...join, email: parsed.data.email || undefined, birthday: parsed.data.birthday || undefined });
  if (!m) return NextResponse.json({ error: "Please check the phone number" }, { status: 400 });
  // Addresses given at sign-up start the book; an existing book is never overwritten from here (no login on this form).
  if (addresses?.length && !(await getAddresses(m.phone)).length) await saveAddresses(m.phone, addresses);
  const wa = await import("@/lib/whatsapp");
  await wa.upsertContact({ phone: m.phone, name: m.name, email: m.email, source: "club", offers: true });
  return NextResponse.json({ ok: true, points: m.points });
}
