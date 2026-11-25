import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { markPaid, markPicked, markReady, sendToSupplier, settleCash } from "@/lib/fulfil";
import { getOrder } from "@/lib/orders";

// Admin: push an order along the supplier → courier flow by hand, and settle payables / courier cash.
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as { id?: string; ids?: string[]; action?: string };
  try {
    if (b.action === "paid" && b.ids?.length) return (await markPaid(b.ids), NextResponse.json({ ok: true }));
    if (b.action === "settle" && b.ids?.length) return (await settleCash(b.ids), NextResponse.json({ ok: true }));
    const o = b.id ? await getOrder(b.id) : null;
    if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (b.action === "send") {
      const sent = await sendToSupplier(o, true);
      return sent ? NextResponse.json({ ok: true, sent }) : NextResponse.json({ error: "Nothing to send: switch on Fulfilment in Admin › Operations, or this order has no products from the supplier" }, { status: 400 });
    }
    if (b.action === "ready") return (await markReady(o.id, "admin"), NextResponse.json({ ok: true }));
    if (b.action === "picked") return (await markPicked(o.id, "admin"), NextResponse.json({ ok: true }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
