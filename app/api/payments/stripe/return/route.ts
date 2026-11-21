import { NextResponse, type NextRequest } from "next/server";
import { getOrder, updateOrder } from "@/lib/orders";
import { getStripeSession } from "@/lib/payments/stripe";

// Stripe Checkout success_url. For production also add a signed webhook
// (checkout.session.completed) — customers sometimes close the tab before redirecting.
export async function GET(req: NextRequest) {
  const order = await getOrder(req.nextUrl.searchParams.get("order") ?? "");
  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  if (!order) return NextResponse.redirect(new URL("/", req.url));
  if (sessionId === order.paymentRef) {
    const s = await getStripeSession(sessionId);
    if (s.paid && s.orderId === order.id) await updateOrder(order.id, { status: "paid" });
  }
  return NextResponse.redirect(new URL(`/order/?id=${order.id}&t=${order.accessToken}`, req.url));
}
