import { limited } from "@/lib/ratelimit";
import { NextResponse, type NextRequest } from "next/server";
import { everySchema, startOk, startSchema } from "@/lib/every";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { addMonths, cancelSubscription, getSubscription, progress, saveSubscription, today, type Subscription } from "@/lib/subscriptions";
import { getGrowth } from "@/lib/growth-store";

// The customer's own subscription (private link from WhatsApp): view, skip, change plan, pause, cancel.
async function load(id: string, t: string) {
  const s = await getSubscription(id);
  return s && t.length === s.token.length && timingSafeEqual(Buffer.from(t), Buffer.from(s.token)) ? s : null;
}
const view = async (s: Subscription) => ({ id: s.id, status: s.status, every: s.every, items: s.items, nextAt: s.nextAt, orders: s.orders.length, name: s.customer.firstName, city: s.customer.city, progress: progress(s, (await getGrowth()).subscribe) });

export async function GET(req: NextRequest) {
  const s = await load(req.nextUrl.searchParams.get("id") ?? "", req.nextUrl.searchParams.get("t") ?? "");
  return s ? NextResponse.json(await view(s)) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "subs", 60);
  if (tooMany) return tooMany;
  const p = z.object({ id: z.string().max(40), t: z.string().max(64), action: z.enum(["skip", "pause", "resume", "cancel", "every", "date", "qty", "remove"]), every: everySchema.optional(), date: startSchema.optional(), productId: z.string().max(60).optional(), qty: z.number().int().min(1).max(20).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const s = await load(p.data.id, p.data.t);
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = p.data;
  if (d.action === "skip") s.nextAt = addMonths(s.nextAt, s.every);
  if (d.action === "pause") s.status = "paused";
  if (d.action === "cancel" && s.status !== "cancelled") await cancelSubscription(s, "customer");
  if (d.action === "resume") { s.status = "active"; if (s.nextAt <= today()) s.nextAt = addDays(today(), 2); }
  if (d.action === "every" && d.every) s.every = d.every;
  if (d.action === "date" && d.date && startOk(d.date)) s.nextAt = d.date;
  if (d.action === "qty" && d.productId && d.qty) s.items = s.items.map((i) => (i.productId === d.productId ? { ...i, qty: d.qty! } : i));
  if (d.action === "remove" && d.productId) { s.items = s.items.filter((i) => i.productId !== d.productId); if (!s.items.length) await cancelSubscription(s, "customer"); }
  await saveSubscription(s);
  return NextResponse.json(await view(s));
}
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
