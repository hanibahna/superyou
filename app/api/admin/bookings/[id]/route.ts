import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { bookingVars } from "@/lib/services";
import { getBooking, saveBooking } from "@/lib/site-store";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const parsed = z.object({ status: z.enum(["pending", "confirmed", "cancelled", "done", "no-show"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  const b = await getBooking((await params).id);
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await saveBooking({ ...b, status: parsed.data.status });
  if (parsed.data.status === "confirmed" && b.status !== "confirmed")
    await (await import("@/lib/whatsapp")).trigger("bookingConfirmed", b.phone, bookingVars(b));
  return NextResponse.json({ ok: true });
}
