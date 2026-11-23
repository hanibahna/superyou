import { NextResponse } from "next/server";
import { adminGuard, currentAdmin } from "@/lib/admin-auth";
import { listOrders } from "@/lib/orders";
import { listBookings } from "@/lib/site-store";
import { listSubscriptions } from "@/lib/subscriptions";

// Native app Owner tab: today at a glance, latest orders, upcoming bookings and subscriptions.
export async function GET() {
  const denied = await adminGuard("orders");
  if (denied) return denied;
  const me = (await currentAdmin())!;
  const [{ orders }, bookings, subs] = await Promise.all([listOrders(0, 100), listBookings(200).catch(() => []), listSubscriptions(500).catch(() => [])]);
  const day = new Date().toISOString().slice(0, 10);
  const live = orders.filter((o) => !["cancelled", "returned", "payment_failed"].includes(o.status));
  const today = live.filter((o) => o.createdAt.slice(0, 10) === day);
  const week = live.filter((o) => Date.now() - Date.parse(o.createdAt) < 7 * 864e5);
  const sum = (a: typeof orders) => Math.round(a.reduce((s, o) => s + o.total, 0) * 100) / 100;
  const now = Date.now();
  return NextResponse.json({
    me: { name: me.name, role: me.role },
    today: { orders: today.length, sales: sum(today) },
    week: { orders: week.length, sales: sum(week) },
    toHandle: live.filter((o) => ["pending_cod", "awaiting_payment", "paid", "confirmed", "packed"].includes(o.status)).length,
    orders: orders.slice(0, 50).map((o) => ({
      id: o.id, createdAt: o.createdAt, status: o.status, total: o.total, payment: o.paymentMethod,
      customer: `${o.customer.firstName} ${o.customer.lastName}`.trim(), phone: o.customer.phone, city: o.customer.city, address: o.customer.address, notes: o.customer.notes ?? "",
      lines: o.lines.map((l) => ({ name: l.name, brand: l.brand, qty: l.qty, lineTotal: l.lineTotal })),
    })),
    bookings: bookings.filter((b) => Date.parse(`${b.date}T${b.time}:00`) > now - 3600e3 && b.status !== "cancelled").slice(0, 30)
      .map((b) => ({ id: b.id, title: b.title, date: b.date, time: b.time, name: b.name, phone: b.phone, status: b.status, mode: b.mode ?? "store", hostUrl: b.video?.hostUrl ?? "" })),
    subscriptions: { active: subs.filter((s) => s.status === "active").length, total: subs.length },
  }, { headers: { "Cache-Control": "no-store" } });
}
