import { NextResponse, type NextRequest } from "next/server";
import { bookingVars } from "@/lib/services";
import { listBookings } from "@/lib/site-store";
import { trigger } from "@/lib/whatsapp";

// Daily (Vercel Cron, see vercel.json): reminders for tomorrow's appointments and events.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const tomorrow = new Date(Date.now() + 86400_000 + 2 * 3600_000).toISOString().slice(0, 10); // Beirut date
  const due = (await listBookings(3000)).filter((b) => b.date === tomorrow && (b.status === "pending" || b.status === "confirmed"));
  for (const b of due) await trigger("bookingReminder", b.phone, bookingVars(b));
  const gs = await import("@/lib/growth-store");
  const followUps = await gs.sendDueReminders(500).catch(() => 0); // review requests + restock reminders
  const birthdays = await gs.sendBirthdays().catch(() => 0);
  const carts = await (await import("@/lib/carts")).sweepCarts(true).catch(() => 0);
  // Videos are searched only when a shopper opens a product (saves the daily YouTube allowance).
  const videos = 0;
  const guides = await (await import("@/lib/product-guide")).prefillGuides(4).catch(() => 0);
  const scanFollowUps = await (await import("@/lib/scans")).runScanFollowUps().catch(() => 0);
  const whishSettled = await (await import("@/lib/payments/whish")).sweepWhish().catch(() => 0);
  // Safety net: a price check that stopped half-way overnight is finished now.
  const priceCheck = await (async () => {
    const pm = await import("@/lib/price-match");
    const { running } = await pm.getReport();
    if (!running) return null;
    const t0 = Date.now();
    let r = await pm.step(t0);
    while (r.more && Date.now() - t0 < 200_000) r = await pm.step(Date.now());
    return r.more ? "partial" : "done";
  })().catch((e) => (console.error("[cron price-match]", e), "error"));
  const lifespans = await (await import("@/lib/lifespan")).buildLifespans(5, 5).then((r) => r.saved).catch(() => 0); // new products
  const subscriptions = await (await import("@/lib/subscriptions")).runSubscriptions().catch((e) => (console.error("[cron subscriptions]", e), null));
  // Live courier tracking for everything still on its way.
  let tracked = 0;
  try {
    const { listOrders } = await import("@/lib/orders");
    const { refreshShipment } = await import("@/lib/tracking");
    for (const o of (await listOrders(0, 500)).orders.filter((x) => x.status === "shipped")) (await refreshShipment(o, 360), tracked++);
  } catch (e) {
    console.error("[cron tracking]", e);
  }
  return NextResponse.json({ ok: true, reminders: due.length, followUps, birthdays, carts, tracked, subscriptions, videos, guides, scanFollowUps, whishSettled, lifespans, priceCheck });
}
