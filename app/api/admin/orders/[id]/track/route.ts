import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getOrder } from "@/lib/orders";
import { refreshShipment } from "@/lib/tracking";

// "Refresh tracking" on the admin order page: asks the courier now.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const o = await getOrder((await params).id);
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const next = await refreshShipment(o, 0);
  return NextResponse.json({ status: next.shipment?.status ?? null, events: next.shipment?.events?.length ?? 0, error: next.shipment?.error ?? null, orderStatus: next.status });
}
