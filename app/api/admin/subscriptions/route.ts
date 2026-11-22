import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { addMonths, getSubscription, runSubscriptions, saveSubscription } from "@/lib/subscriptions";

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = z.object({ id: z.string().max(40).optional(), action: z.enum(["pause", "resume", "cancel", "skip", "date", "run"]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  if (p.data.action === "run") return NextResponse.json(await runSubscriptions());
  const s = p.data.id ? await getSubscription(p.data.id) : null;
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (p.data.action === "pause") s.status = "paused";
  if (p.data.action === "resume") s.status = "active";
  if (p.data.action === "cancel") s.status = "cancelled";
  if (p.data.action === "skip") s.nextAt = addMonths(s.nextAt, s.every);
  if (p.data.action === "date" && p.data.date) s.nextAt = p.data.date;
  await saveSubscription(s);
  return NextResponse.json({ ok: true });
}
