import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { limited } from "@/lib/ratelimit";
import { orderIdsByPhone, getGrowth } from "@/lib/growth-store";
import { normPhone } from "@/lib/wa";
import { everySchema, startOk, startSchema } from "@/lib/every";
import { addMonths, cancelSubscription, listSubscriptions, progress, saveSubscription, today, type Subscription } from "@/lib/subscriptions";

// Native app: the shopper's subscriptions (phone + one of their order numbers, as for the account): view, skip, change, pause, cancel.
async function mine(phone: string, order: string) {
  const ids = phone ? await orderIdsByPhone(phone) : [];
  if (!ids.includes(order.trim().toUpperCase())) return null;
  const p = normPhone(phone);
  return (await listSubscriptions()).filter((s) => normPhone(s.customer.phone ?? "") === p);
}
const view = async (s: Subscription) => ({ id: s.id, status: s.status, every: s.every, items: s.items, nextAt: s.nextAt, endsAt: s.endsAt ?? null, orders: s.orders.length, progress: progress(s, (await getGrowth()).subscribe) });

export async function GET(req: NextRequest) {
  const list = await mine(req.nextUrl.searchParams.get("phone") ?? "", req.nextUrl.searchParams.get("order") ?? "");
  if (!list) return NextResponse.json({ error: "We couldn't match that phone number and order number" }, { status: 404 });
  return NextResponse.json({ subscriptions: await Promise.all(list.filter((s) => s.status !== "cancelled").map(view)) });
}

export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "subs", 60);
  if (tooMany) return tooMany;
  const p = z.object({ phone: z.string().max(30), order: z.string().max(40), id: z.string().max(40), action: z.enum(["skip", "pause", "resume", "cancel", "every", "date"]), every: everySchema.optional(), date: startSchema.optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const d = p.data;
  const s = (await mine(d.phone, d.order))?.find((x) => x.id === d.id);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (d.action === "skip") s.nextAt = addMonths(s.nextAt, s.every);
  if (d.action === "pause") s.status = "paused";
  if (d.action === "cancel" && s.status !== "cancelled") await cancelSubscription(s, "customer");
  if (d.action === "resume") { s.status = "active"; if (s.nextAt <= today()) s.nextAt = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10); }
  if (d.action === "every" && d.every) s.every = d.every;
  if (d.action === "date" && d.date && startOk(d.date)) s.nextAt = d.date;
  await saveSubscription(s);
  return NextResponse.json(await view(s));
}
