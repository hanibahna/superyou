import { NextResponse, type NextRequest } from "next/server";
import { getOrder, updateOrder } from "@/lib/orders";
import { getAreebaOrder } from "@/lib/payments/areeba";

// MPGS Hosted Checkout returns here: ?order=…&resultIndicator=…
// We confirm the outcome by querying the gateway directly.
export async function GET(req: NextRequest) {
  const order = await getOrder(req.nextUrl.searchParams.get("order") ?? "");
  if (!order) return NextResponse.redirect(new URL("/", req.url));
  const g = await getAreebaOrder(order.id);
  const status = g.result === "SUCCESS" && g.status === "CAPTURED" ? "paid" : g.status === "FAILED" ? "payment_failed" : order.status;
  await updateOrder(order.id, { status });
  return NextResponse.redirect(new URL(`/order/?id=${order.id}&t=${order.accessToken}`, req.url));
}
