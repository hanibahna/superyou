import { NextResponse, type NextRequest } from "next/server";
import { getOrder, updateOrder } from "@/lib/orders";
import { getTapCharge, tapStatusToOrder } from "@/lib/payments/tap";

// Customer lands here after the Tap payment page: ?order=…&tap_id=chg_…
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("order") ?? "";
  const tapId = req.nextUrl.searchParams.get("tap_id") ?? "";
  const order = await getOrder(orderId);
  if (!order) return NextResponse.redirect(new URL("/", req.url));
  if (tapId && tapId === order.paymentRef) {
    const charge = await getTapCharge(tapId);
    if (charge.orderId === order.id) await updateOrder(order.id, { status: tapStatusToOrder(charge.status) });
  }
  return NextResponse.redirect(new URL(`/order/?id=${order.id}&t=${order.accessToken}`, req.url));
}
