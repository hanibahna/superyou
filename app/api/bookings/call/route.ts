import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getBooking } from "@/lib/site-store";
import { getVideo, startsAt } from "@/lib/video";

// The customer's call page asks here (booking id + secret from their link). The room address is only
// given out from a few minutes before the start until an hour after the end.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  const b = await getBooking(id);
  const ok = b?.access && t.length === b.access.length && timingSafeEqual(Buffer.from(t), Buffer.from(b.access));
  if (!b || !ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const v = await getVideo();
  const start = startsAt(b);
  const now = Math.floor(Date.now() / 1000);
  const open = now >= start - v.openBefore * 60 && now <= start + (b.duration || 30) * 60 + 3600;
  return NextResponse.json({
    id: b.id, title: b.title, date: b.date, time: b.time, duration: b.duration, name: b.name.split(" ")[0], status: b.status, mode: b.mode ?? "store",
    startsAt: start, opensAt: start - v.openBefore * 60,
    roomUrl: open && b.status !== "cancelled" && b.mode === "video" ? b.video?.roomUrl ?? null : null,
    ready: !!b.video,
  });
}
