import { limited } from "@/lib/ratelimit";
import { NextResponse, type NextRequest } from "next/server";
import { buySchema, createGiftCardOrder } from "@/lib/giftcard-sale";
import { baseUrl } from "@/lib/http";
import { saveOrder, updateOrder } from "@/lib/orders";
import { checkoutMethods, startPayment } from "@/lib/payments";

// Buy a gift card online (same payment flow as checkout).
export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "giftcards", 10);
  if (tooMany) return tooMany;
  const parsed = buySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the form." }, { status: 400 });
  if (!(await checkoutMethods()).some((m) => m.id === parsed.data.paymentMethod)) return NextResponse.json({ error: "That payment method isn't available." }, { status: 400 });
  let order;
  try {
    order = await createGiftCardOrder(parsed.data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
  const confirmUrl = `/order/?id=${order.id}&t=${order.accessToken}`;
  try {
    const result = await startPayment(order, baseUrl(req));
    order.paymentProvider = result.provider;
    await saveOrder(order);
    return NextResponse.json({ orderId: order.id, next: { redirect: result.kind === "redirect" ? result.url : confirmUrl } });
  } catch (e) {
    console.error(e);
    await updateOrder(order.id, { status: "payment_failed" });
    return NextResponse.json({ error: "We couldn't start the payment. Please try again or choose another way to pay." }, { status: 502 });
  }
}
