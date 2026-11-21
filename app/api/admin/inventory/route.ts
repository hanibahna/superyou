import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard, currentAdmin } from "@/lib/admin-auth";
import { adjustStock } from "@/lib/inventory";

const schema = z.object({
  changes: z.array(z.object({ productId: z.string().max(60), set: z.number().int().min(0).max(1_000_000).optional(), delta: z.number().int().min(-1_000_000).max(1_000_000).optional() })).min(1).max(2000),
  reason: z.string().max(120).optional(),
});

// Set or adjust stock counts (count, delivery received, damaged…).
export async function POST(req: NextRequest) {
  const denied = await adminGuard("inventory");
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the quantities" }, { status: 400 });
  const moves = await adjustStock(parsed.data.changes, parsed.data.reason || "Stock count", (await currentAdmin())!.name);
  return NextResponse.json({ ok: true, changed: moves.length });
}
