import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getOrder, publicOrder } from "@/lib/orders";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const order = await getOrder((await params).id);
  const t = req.nextUrl.searchParams.get("t") ?? "";
  const ok = order && t.length === order.accessToken.length && timingSafeEqual(Buffer.from(t), Buffer.from(order.accessToken));
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(publicOrder(order));
}
