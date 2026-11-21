import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard, currentAdmin } from "@/lib/admin-auth";
import { ORDER_STATUSES, shipOrder, updateOrder } from "@/lib/orders";

const schema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  note: z.string().max(300).optional(),
  ship: z.object({ courier: z.string().max(30), tracking: z.string().max(80) }).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard("orders");
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  const me = (await currentAdmin())!;
  const id = (await params).id;
  const { status, note, ship } = parsed.data;
  const order = ship ? await shipOrder(id, ship.courier, ship.tracking, me.name) : status ? await updateOrder(id, { status }, me.name, note) : null;
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
