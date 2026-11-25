import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { deleteBulkBuyer, saveBulkBuyer } from "@/lib/bulk";

// Admin › Bulk buyers: add, edit or remove an authorized company or person.
export async function POST(req: NextRequest) {
  const denied = await adminGuard("orders");
  if (denied) return denied;
  const b = z.object({
    phone: z.string().trim().min(6).max(30), name: z.string().trim().max(80).default(""), company: z.string().trim().max(120).default(""),
    pct: z.number().min(0).max(60), maxUnits: z.number().int().min(0).max(10000), minQty: z.number().int().min(1).max(1000).default(1),
    notes: z.string().max(1000).default(""), active: z.boolean().default(true), enquiry: z.string().max(40).optional(),
  }).safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "Please check the phone number and discount" }, { status: 400 });
  if (!b.data.name && !b.data.company) return NextResponse.json({ error: "Add a company or a person's name" }, { status: 400 });
  try {
    const v = await saveBulkBuyer(b.data);
    if (b.data.enquiry) await (await import("@/lib/wholesale")).setWholesaleStatus(b.data.enquiry, "approved");
    return NextResponse.json({ ok: true, buyer: v });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await adminGuard("orders");
  if (denied) return denied;
  const phone = req.nextUrl.searchParams.get("phone") ?? "";
  await deleteBulkBuyer(phone);
  return NextResponse.json({ ok: true });
}
