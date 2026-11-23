import { NextResponse, type NextRequest } from "next/server";
import { getOrder } from "@/lib/orders";
import { settleWhish } from "@/lib/payments/whish";

// The customer comes back from Whish: check the payment with Whish, then show their order.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("order") ?? "";
  await settleWhish(id).catch((e) => console.error("[whish] return", e));
  const o = await getOrder(id);
  if (!o) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.redirect(new URL(`/order/?id=${o.id}&t=${o.accessToken}`, req.url));
}
