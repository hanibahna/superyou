import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { limited } from "@/lib/ratelimit";
import { liveProducts } from "@/lib/pricing";
import { addStockAlert } from "@/lib/stock-alerts";
import { normPhone } from "@/lib/wa";

// A shopper asks to be told when a sold-out product is back.
export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "stockalert", 20);
  if (tooMany) return tooMany;
  const b = z.object({ productId: z.string().max(80), phone: z.string().max(30), via: z.enum(["whatsapp", "sms"]).default("whatsapp"), email: z.string().email().max(200).optional().or(z.literal("")), name: z.string().max(60).optional() }).safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "Please check your details" }, { status: 400 });
  const phone = normPhone(b.data.phone);
  if (!phone) return NextResponse.json({ error: "Please check the mobile number" }, { status: 400 });
  const p = (await liveProducts()).byId.get(b.data.productId);
  if (!p) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  await addStockAlert(p.id, { phone, via: b.data.via, email: b.data.email?.toLowerCase() || undefined, name: b.data.name?.trim() || undefined, at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
