import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { deleteMember, orderIdsByPhone } from "@/lib/growth-store";
import { normPhone } from "@/lib/wa";

// "Delete my account" (required by Apple for apps with accounts). Same check as the account page:
// phone + one of their order numbers. Removes the Club membership, saved addresses and the WhatsApp/SMS
// contact. Orders and invoices are kept, as the law requires for accounting.
export async function POST(req: NextRequest) {
  const p = z.object({ phone: z.string().max(30), order: z.string().max(40), confirm: z.literal(true) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Please confirm" }, { status: 400 });
  const ids = await orderIdsByPhone(p.data.phone);
  if (!ids.includes(p.data.order.trim().toUpperCase())) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const phone = normPhone(p.data.phone) || p.data.phone;
  await deleteMember(phone).catch(() => false);
  await db.cmd(["DEL", `addr:${phone}`]).catch(() => {});
  await (await import("@/lib/whatsapp")).deleteContact(phone).catch(() => {});
  return NextResponse.json({ ok: true });
}
