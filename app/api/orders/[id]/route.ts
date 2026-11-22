import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getOrder, publicOrder } from "@/lib/orders";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const order = await getOrder((await params).id);
  const t = req.nextUrl.searchParams.get("t") ?? "";
  const ok = order && t.length === order.accessToken.length && timingSafeEqual(Buffer.from(t), Buffer.from(order.accessToken));
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Shipped with a courier that has live tracking: ask it again if the last check is over an hour old.
  const fresh = order.status === "shipped" ? await (await import("@/lib/tracking")).refreshShipment(order, 60).catch(() => order) : order;
  return NextResponse.json(publicOrder(fresh));
}
