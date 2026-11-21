import { NextResponse, type NextRequest } from "next/server";
import { baseUrl } from "@/lib/http";
import { checkoutSchema, createOrder, saveOrder, updateOrder } from "@/lib/orders";
import { checkoutMethods, startPayment } from "@/lib/payments";

export async function POST(req: NextRequest) {
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the highlighted fields.", issues: parsed.error.issues }, { status: 400 });
  if (!(await checkoutMethods()).some((m) => m.id === parsed.data.paymentMethod))
    return NextResponse.json({ error: "That payment method isn't available." }, { status: 400 });

  let order;
  try {
    order = await createOrder(parsed.data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }

  // Fully paid by gift card: nothing to collect.
  if (order.total === 0) {
    const confirmUrl = `/order/?id=${order.id}&t=${order.accessToken}`;
    return NextResponse.json({ orderId: order.id, next: { redirect: confirmUrl }, confirmUrl });
  }

  try {
    const result = await startPayment(order, baseUrl(req));
    order.paymentProvider = result.provider;
    await saveOrder(order); // persists paymentRef set by the provider
    if (result.kind === "confirmed") await updateOrder(order.id, {}); // hook point
    const confirmUrl = `/order/?id=${order.id}&t=${order.accessToken}`;
    return NextResponse.json({
      orderId: order.id,
      next: result.kind === "redirect" ? { redirect: result.url } : { redirect: confirmUrl },
      message: result.kind === "instructions" ? result.message : undefined,
      confirmUrl,
    });
  } catch (e) {
    console.error(e);
    await updateOrder(order.id, { status: "payment_failed" });
    return NextResponse.json({ error: "We couldn't start the payment. Please try again or choose cash on delivery." }, { status: 502 });
  }
}
