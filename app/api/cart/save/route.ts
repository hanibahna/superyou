import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { saveCart, sweepCarts } from "@/lib/carts";
import { getLang } from "@/lib/i18n-server";

const schema = z.object({
  phone: z.string().min(6).max(20),
  name: z.string().max(80).optional(),
  items: z.array(z.object({ productId: z.string().max(60), qty: z.number().int().min(1).max(20) })).min(1).max(60),
  code: z.string().max(40).optional(),
  consent: z.boolean().optional(),
});

// Checkout saves the bag against the shopper's mobile so it can be picked up again later.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const d = parsed.data;
  await saveCart({ phone: d.phone, name: d.name ?? "", items: d.items, code: d.code, consent: !!d.consent, lang: await getLang() }).catch(() => null);
  after(() => sweepCarts().catch(() => 0));
  return NextResponse.json({ ok: true });
}
