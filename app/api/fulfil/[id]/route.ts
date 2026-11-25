import { NextResponse, type NextRequest } from "next/server";
import { limited } from "@/lib/ratelimit";
import { markDelivered, markPicked, markReady, sendCourierDetails, storePod, tokenFor, type Role } from "@/lib/fulfil";

// The supplier and the courier update an order from the label link (no login: the link carries a key).
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tooMany = await limited(req, "fulfil", 60);
  if (tooMany) return tooMany;
  const { id } = await params;
  const form = await req.formData();
  const t = String(form.get("t") ?? ""), r = String(form.get("r") ?? "") as Role, action = String(form.get("action") ?? "");
  // Label scanned by any phone: the details go to the courier's WhatsApp only (no key needed, nothing returned).
  if (action === "scan") {
    try { return NextResponse.json({ ok: true, result: await sendCourierDetails(id) }); }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  }
  if ((r !== "s" && r !== "c") || t !== tokenFor(id, r)) return NextResponse.json({ error: "This link is not valid" }, { status: 403 });
  try {
    if (action === "ready" && r === "s") return NextResponse.json({ ok: true, stage: (await markReady(id, "supplier"))?.fulfil?.stage });
    if (action === "picked" && r === "c") return NextResponse.json({ ok: true, stage: (await markPicked(id, "courier"))?.fulfil?.stage });
    if (action === "delivered" && r === "c") {
      const photo = form.get("photo");
      if (!(photo instanceof File) || !photo.size) return NextResponse.json({ error: "Take a photo of the parcel with the customer" }, { status: 400 });
      if (photo.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Photo too large (max 12 MB)" }, { status: 400 });
      const url = await storePod(id, await photo.arrayBuffer(), photo.type || "image/jpeg");
      return NextResponse.json({ ok: true, stage: (await markDelivered(id, url, "page", "courier"))?.fulfil?.stage });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ error: "Not allowed" }, { status: 400 });
}
