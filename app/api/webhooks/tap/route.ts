import { NextResponse, type NextRequest } from "next/server";
import { getOrder, updateOrder } from "@/lib/orders";
import { getTapCharge, tapStatusToOrder } from "@/lib/payments/tap";

// Server-to-server notification from Tap. We don't trust the body:
// we take the charge id and re-fetch the charge from Tap's API.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const chargeId: string | undefined = body?.id;
  if (!chargeId) return NextResponse.json({ ok: false }, { status: 400 });
  const charge = await getTapCharge(chargeId);
  const order = charge.orderId ? await getOrder(charge.orderId) : null;
  if (order && order.paymentRef === chargeId) await updateOrder(order.id, { status: tapStatusToOrder(charge.status) });
  return NextResponse.json({ ok: true });
}
