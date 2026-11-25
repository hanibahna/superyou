import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { getOps } from "@/lib/ops-store";
import { createOrder } from "@/lib/orders";
import { liveProducts } from "@/lib/pricing";
import { getSettings } from "@/lib/site-store";

// Admin: create a test order (two in-stock products from the supplier, cash on delivery) or delete all test orders.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const denied = await adminGuard("orders");
  if (denied) return denied;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action === "clear") {
    const ids = (await db.cmd<string[]>(["ZRANGE", "orders:test", 0, -1])) ?? [];
    for (const id of ids) await db.cmd(["DEL", `order:${id}`]);
    await db.cmd(["DEL", "orders:test"]);
    return NextResponse.json({ ok: true, deleted: ids.length });
  }
  const [ops, settings, live] = await Promise.all([getOps(), getSettings(), liveProducts()]);
  const src = ops.fulfil.source.toLowerCase();
  const pool = live.list.filter((p) => p.inStock && (p.source ?? "").toLowerCase() === src);
  const pick = (pool.length ? pool : live.list.filter((p) => p.inStock)).sort(() => Math.random() - 0.5).slice(0, 2);
  if (!pick.length) return NextResponse.json({ error: "No products in stock to test with" }, { status: 400 });
  const phone = ops.fulfil.teamWhatsapp || settings.store.whatsapp || "+96170000000";
  const order = await createOrder({
    items: pick.map((p) => ({ productId: p.id, qty: 1 })),
    customer: { firstName: "Test", lastName: "Customer", phone, email: "", zone: "Metn", city: "Jdeideh", address: "Test address, do not deliver", notes: "TEST ORDER" },
    paymentMethod: "cod",
    waUpdates: false,
  } as unknown as Parameters<typeof createOrder>[0], { test: true });
  return NextResponse.json({ ok: true, id: order.id });
}
