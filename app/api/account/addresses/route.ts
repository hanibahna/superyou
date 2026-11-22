import { limited } from "@/lib/ratelimit";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAddresses, saveAddresses } from "@/lib/address-store";
import { addressListSchema } from "@/lib/addresses";
import { orderIdsByPhone } from "@/lib/growth-store";

// The customer's address book. Same light check as the account page: phone + one of their order numbers.
async function allowed(phone: string, order: string) {
  if (!phone || !order) return false;
  return (await orderIdsByPhone(phone)).includes(order.trim().toUpperCase());
}

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone") ?? "";
  if (!(await allowed(phone, req.nextUrl.searchParams.get("order") ?? ""))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ addresses: await getAddresses(phone) });
}

export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "addr", 60);
  if (tooMany) return tooMany;
  const p = z.object({ phone: z.string().max(30), order: z.string().max(40), addresses: addressListSchema }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Please check the addresses" }, { status: 400 });
  if (!(await allowed(p.data.phone, p.data.order))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await saveAddresses(p.data.phone, p.data.addresses);
  return NextResponse.json({ ok: true });
}
