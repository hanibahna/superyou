import { type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getBooking } from "@/lib/site-store";
import { ics } from "@/lib/video";
import { siteUrl } from "@/lib/site-url";

// "Add to calendar" file for a booking (customer link or admin).
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  const b = await getBooking(id);
  const ok = b?.access && t.length === b.access.length && timingSafeEqual(Buffer.from(t), Buffer.from(b.access));
  if (!b || !ok) return new Response("Not found", { status: 404 });
  const link = `${siteUrl()}/call/${b.id}/?t=${b.access}`;
  return new Response(ics(b, link), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="superyou-${b.id}.ics"` } });
}
