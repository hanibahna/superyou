import { limited } from "@/lib/ratelimit";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { bookingVars, type Booking } from "@/lib/services";
import { getServices, listBookings, saveBooking } from "@/lib/site-store";
import { freeSlots } from "@/lib/booking";

const schema = z.object({
  kind: z.enum(["service", "event", "clinic"]),
  refId: z.string().max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  name: z.string().min(2).max(100),
  phone: z.string().min(6).max(30),
  email: z.string().email().max(200).or(z.literal("")).optional(),
  guests: z.number().int().min(1).max(10).optional(),
  waOffers: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  mode: z.enum(["store", "video"]).optional(),
});

// Book a service slot or sign up for an event.
export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "bookings", 20);
  if (tooMany) return tooMany;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please fill in your name and phone number" }, { status: 400 });
  const d = parsed.data;
  const cfg = await getServices();
  if (!cfg.enabled && d.kind !== "clinic") return NextResponse.json({ error: "Bookings are closed" }, { status: 400 });
  const base = { id: `BK-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`, name: d.name.trim(), phone: d.phone.trim(), email: d.email ?? "", notes: d.notes ?? "", status: "pending" as const, createdAt: new Date().toISOString() };
  let b: Booking;
  if (d.kind === "clinic") {
    // Partner-clinic treatment: a request for a preferred date; our team confirms the date on WhatsApp.
    const { CLINIC, getProcedure } = await import("@/lib/clinic");
    const p = getProcedure(d.refId);
    if (!p || !d.date) return NextResponse.json({ error: "Choose a treatment and a preferred date" }, { status: 400 });
    b = { ...base, kind: "clinic", refId: p.id, title: `${p.name} at ${CLINIC.partner}`, date: d.date, time: d.time ?? "", duration: p.minutes, guests: 1, mode: "store", notes: [d.notes ?? "", `From $${p.priceFrom} (indicative)`, "Date to be confirmed"].filter(Boolean).join(" · ") };
  } else if (d.kind === "service") {
    const s = cfg.services.find((x) => x.id === d.refId && x.enabled);
    if (!s || !d.date || !d.time) return NextResponse.json({ error: "Choose a service, date and time" }, { status: 400 });
    if (!(await freeSlots(s.id, d.date)).includes(d.time)) return NextResponse.json({ error: "Sorry, that time was just taken. Please pick another." }, { status: 409 });
    const mode = s.video === "only" ? "video" : s.video === "yes" && d.mode === "video" ? "video" : "store";
    b = { ...base, kind: "service", refId: s.id, title: s.title, date: d.date, time: d.time, duration: s.duration, guests: 1, mode, access: (await import("@/lib/video")).newAccess() };
    // Video call: create the room now (if a provider is set up); otherwise it's created when the team confirms.
    if (mode === "video") b.video = (await (await import("@/lib/video")).createRoom(b).catch((e) => (console.error("[video]", e), null))) ?? undefined;
  } else {
    const e = cfg.events.find((x) => x.id === d.refId && x.enabled);
    if (!e) return NextResponse.json({ error: "Unknown event" }, { status: 404 });
    if (new Date(`${e.date}T${e.end}:00+02:00`).getTime() < Date.now()) return NextResponse.json({ error: "This event has ended" }, { status: 400 });
    const guests = d.guests ?? 1;
    if (e.capacity) {
      const taken = (await listBookings()).filter((x) => x.kind === "event" && x.refId === e.id && x.status !== "cancelled").reduce((n, x) => n + x.guests, 0);
      if (taken + guests > e.capacity) return NextResponse.json({ error: e.capacity - taken > 0 ? `Only ${e.capacity - taken} place(s) left` : "This event is full" }, { status: 409 });
    }
    b = { ...base, kind: "event", refId: e.id, title: e.title, date: e.date, time: e.start, duration: 0, guests };
  }
  await saveBooking(b);
  await onBooking(b, d.waOffers === true).catch((e) => console.error("[whatsapp] booking", e));
  return NextResponse.json({ ok: true, booking: { id: b.id, title: b.title, date: b.date, time: b.time, mode: b.mode ?? "store", link: b.access ? `/call/${b.id}/?t=${b.access}` : "" } });
}

async function onBooking(b: Booking, offers: boolean) {
  const wa = await import("@/lib/whatsapp");
  const res = await wa.upsertContact({ phone: b.phone, name: b.name, email: b.email, source: "booking", service: b.title, updates: true, offers: offers || undefined });
  const vars = bookingVars(b);
  await wa.trigger("bookingReceived", b.phone, vars);
  if (res?.newOptIn) await wa.trigger("welcomeOptIn", b.phone, vars);
}
