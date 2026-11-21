import { NextResponse, type NextRequest } from "next/server";
import { freeSlots } from "@/lib/booking";
import { getServices } from "@/lib/site-store";

// Free start times for a service on a date.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("service") ?? "";
  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const cfg = await getServices();
  const s = cfg.services.find((x) => x.id === id && x.enabled);
  if (!s || !cfg.enabled) return NextResponse.json({ error: "Unknown service" }, { status: 404 });
  return NextResponse.json({ slots: await freeSlots(id, date) });
}

