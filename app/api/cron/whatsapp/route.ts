import { NextResponse, type NextRequest } from "next/server";
import { bookingVars } from "@/lib/services";
import { listBookings } from "@/lib/site-store";
import { trigger } from "@/lib/whatsapp";

// Daily (Vercel Cron, see vercel.json): reminders for tomorrow's appointments and events.
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
  return NextResponse.json({ ok: true, reminders: due.length, followUps, birthdays, carts });
}
