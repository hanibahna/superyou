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
  const next = { ...b, status: parsed.data.status };
  // Confirming a video call without a room yet (provider added later): create it now.
  if (parsed.data.status === "confirmed" && next.mode === "video" && !next.video) {
    const v = await import("@/lib/video");
    next.access = next.access ?? v.newAccess();
    next.video = (await v.createRoom(next).catch((e) => (console.error("[video]", e), null))) ?? undefined;
  }
  await saveBooking(next);
  if (parsed.data.status === "confirmed" && b.status !== "confirmed")
    await (await import("@/lib/whatsapp")).trigger("bookingConfirmed", b.phone, bookingVars(next));
  return NextResponse.json({ ok: true });
}
