import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard, currentAdmin } from "@/lib/admin-auth";
import { getOrder, ORDER_STATUSES, shipOrder, updateOrder } from "@/lib/orders";

const schema = z.object({
  ids: z.array(z.string().max(40)).min(1).max(200),
  status: z.enum(ORDER_STATUSES).optional(),
  courier: z.string().max(30).optional(), // with status "shipped": hand them all to this courier
});

// Several orders at once (pickup sheet, order list).
export async function POST(req: NextRequest) {
  const denied = await adminGuard("orders");
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.status && !parsed.data.courier)) return NextResponse.json({ error: "Nothing to do" }, { status: 400 });
  const me = (await currentAdmin())!;
  let done = 0;
  for (const id of parsed.data.ids) {
    const o = parsed.data.courier ? await shipOrder(id, parsed.data.courier, (await getOrder(id))?.shipment?.tracking ?? "", me.name) : await updateOrder(id, { status: parsed.data.status }, me.name);
    if (o) done++;
  }
  return NextResponse.json({ ok: true, done });
}
