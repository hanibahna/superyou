import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { serverQuote } from "@/lib/pricing";

const schema = z.object({
  items: z.array(z.object({ productId: z.string().max(60), qty: z.number().int().min(1).max(20) })).max(100),
  code: z.string().max(40).optional(),
  zone: z.string().max(60).optional(),
});

// Live cart prices, discounts, free-gift tiers and delivery for the cart and checkout.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
  const { _lines, _promos, _settings, ...q } = await serverQuote(parsed.data);
  void _lines; void _promos; void _settings;
  return NextResponse.json(q);
}
