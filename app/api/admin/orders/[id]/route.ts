import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { ORDER_STATUSES, updateOrder, type OrderStatus } from "@/lib/orders";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { status } = (await req.json().catch(() => ({}))) as { status?: OrderStatus };
  if (!status || !ORDER_STATUSES.includes(status)) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  const order = await updateOrder((await params).id, { status });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
