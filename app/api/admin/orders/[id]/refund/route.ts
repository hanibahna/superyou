import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard, currentAdmin } from "@/lib/admin-auth";
import { refundOrder } from "@/lib/orders";

const schema = z.object({
  amount: z.number().positive().max(100000),
  reason: z.string().max(300),
  method: z.enum(["cash", "card", "whish", "giftcard", "other"]),
  restocked: z.array(z.object({ productId: z.string().max(60), qty: z.number().int().min(1).max(100) })).max(100),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard("orders");
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the refund amount" }, { status: 400 });
  try {
    const { refund } = await refundOrder((await params).id, { ...parsed.data, amount: +parsed.data.amount.toFixed(2), by: (await currentAdmin())!.name });
    return NextResponse.json({ ok: true, refund });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
