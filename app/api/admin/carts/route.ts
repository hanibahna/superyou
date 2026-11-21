import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { deleteCart, sweepCarts } from "@/lib/carts";

export async function POST(req: NextRequest) {
  const denied = await adminGuard("orders");
  if (denied) return denied;
  const { action, phone } = (await req.json().catch(() => ({}))) as { action?: string; phone?: string };
  if (action === "delete" && phone) await deleteCart(phone);
  else if (action === "sweep") return NextResponse.json({ ok: true, sent: await sweepCarts(true) });
  return NextResponse.json({ ok: true });
}
