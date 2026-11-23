"use client";

import { useT } from "@/lib/site-context";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { money } from "@/lib/format";
import { imgUrl } from "@/lib/img";
import type { EventItem, Service } from "@/lib/services";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Props = { tab: "services" | "events"; intro: string; location: string; hours: { day: number; open: string; close: string }[]; daysAhead: number; services: Service[]; events: EventItem[]; whatsapp: string };

export function ServicesView(p: Props) {
  const tx = useT();
  const [tab, setTab] = useState(p.tab);
  const [cat, setCat] = useState(tx("All"));
  const [booking, setBooking] = useState<Service | null>(null);
  // Deep link from the quick buttons: /services/?book=video-consult opens that booking straight away.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("book");
    const s = id ? p.services.find((x) => x.id === id && x.enabled) : undefined;
    if (s) setBooking(s);
  }, [p.services]);
  const [rsvp, setRsvp] = useState<EventItem | null>(null);
  const cats = ["All", ...Array.from(new Set(p.services.map((s) => s.category).filter(Boolean)))];
  const shown = p.services.filter((s) => cat === "All" || s.category === cat);
  const open = Array.from(new Set(p.hours.map((h) => `${h.open}–${h.close}`)));

  return (
    <div>
      <section className="bg-black text-white">
        <div className="container-x py-12">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/70">{tx("In store")}</p>
          <h1 className="mt-2 text-4xl font-black uppercase tracking-tight md:text-6xl">Services &amp; Events</h1>
          <p className="mt-3 max-w-xl text-white/80">{p.intro}</p>
          <Link href="/clinic/" className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black">{tx("Clinic treatments with our dermatologist")} →</Link>
          <p className="mt-4 text-sm text-white/60">📍 {p.location}{open.length === 1 && ` · ${p.hours.map((h) => dayNames[h.day]).join(", ")} ${open[0]}`}</p>
        </div>
      </section>
      <div className="container-x">
        <div className="sticky top-[7.6rem] z-10 -mx-4 flex gap-6 border-b border-line bg-white px-4 text-sm font-bold">
          {(["services", "events"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`border-b-2 py-4 ${tab === t ? "border-black" : "border-transparent text-muted"}`}>
              {t === "services" ? `Beauty services (${p.services.length})` : `Events (${p.events.length})`}
            </button>
          ))}
        </div>

        {tab === "services" ? (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-4 py-1.5 text-sm ${cat === c ? "border-black bg-black text-white" : "border-line hover:border-black"}`}>{c}</button>)}
            </div>
            <div className="mt-6 grid gap-5 pb-14 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((s) => (
                <article key={s.id} className="flex flex-col overflow-hidden rounded-lg border border-line">
                  <div className="aspect-[16/10] bg-[#f6f2ee]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.image && <img src={imgUrl(s.image, 600)} alt="" className="h-full w-full object-contain p-6 mix-blend-multiply" loading="lazy" />}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">{s.category} · {s.duration} min</p>
                    <h2 className="mt-1 text-lg font-bold">{s.title}</h2>
                    <p className="mt-2 flex-1 text-sm text-muted">{s.description}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span><b>{s.price ? money(s.price) : tx("Free")}</b>{s.priceNote && <span className="block text-xs text-muted">{s.priceNote}</span>}</span>
                      <button onClick={() => setBooking(s)} className="rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white hover:bg-ink/80">{tx("Book now")}</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-5 py-8 pb-14">
            {p.events.length === 0 && <p className="text-muted">{tx("No upcoming events right now. Check back soon!")}</p>}
            {p.events.map((e) => (
              <article key={e.id} className="grid overflow-hidden rounded-lg border border-line md:grid-cols-[280px_1fr]">
                <div className="relative aspect-[16/10] bg-[#f6f2ee] md:aspect-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {e.image && <img src={imgUrl(e.image, 600)} alt="" className="absolute inset-0 h-full w-full object-contain p-6 mix-blend-multiply" loading="lazy" />}
                  <span className="absolute left-3 top-3 rounded bg-black px-3 py-2 text-center text-white">
                    <span className="block text-2xl font-black leading-none">{new Date(`${e.date}T12:00:00`).getDate()}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">{new Date(`${e.date}T12:00:00`).toLocaleDateString("en-GB", { month: "short" })}</span>
                  </span>
                </div>
                <div className="p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">{fmtDate(e.date)} · {e.start}–{e.end} · {e.location}</p>
                  <h2 className="mt-1 text-xl font-bold">{e.title}</h2>
                  <p className="mt-2 text-sm text-muted">{e.description}</p>
                  <div className="mt-4 flex items-center gap-4">
                    <button onClick={() => setRsvp(e)} className="rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white">{e.price ? `Reserve · ${money(e.price)}` : "RSVP — free"}</button>
                    {e.capacity > 0 && <span className="text-xs text-muted">Limited to {e.capacity} guests</span>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      {booking && <BookingDialog service={booking} daysAhead={p.daysAhead} openDays={p.hours.map((h) => h.day)} whatsapp={p.whatsapp} onClose={() => setBooking(null)} />}
      {rsvp && <RsvpDialog event={rsvp} whatsapp={p.whatsapp} onClose={() => setRsvp(null)} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const tx = useT();
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label={tx("Close")} className="text-xl leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const field = "w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-black";

function Contact({ onSubmit, busy, error, guests, label }: { onSubmit: (d: { name: string; phone: string; email: string; notes: string; guests: number; waOffers: boolean }) => void; busy: boolean; error: string; guests?: boolean; label: string }) {
  const tx = useT();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({ name: String(f.get("name")), phone: String(f.get("phone")), email: String(f.get("email") ?? ""), notes: String(f.get("notes") ?? ""), guests: Number(f.get("guests") ?? 1), waOffers: f.get("waOffers") === "on" });
      }}
      className="mt-4 grid gap-3"
    >
      <input name="name" required placeholder={tx("Full name")} className={field} />
      <input name="phone" required placeholder={tx("Mobile (WhatsApp)")} inputMode="tel" className={field} />
      <input name="email" type="email" placeholder="Email (optional)" className={field} />
      {guests && (
        <select name="guests" className={field} defaultValue="1">
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} {n === 1 ? "guest" : "guests"}</option>)}
        </select>
      )}
      <textarea name="notes" rows={2} placeholder="Anything we should know? (optional)" className={field} />
      <p className="text-xs text-muted">We'll send your confirmation and a reminder on WhatsApp.</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="waOffers" className="mt-0.5" /> {tx("Also send me offers and event invitations on WhatsApp")}</label>
      {error && <p className="text-sm text-sale">{error}</p>}
      <button disabled={busy} className="rounded-full bg-black py-3 font-bold text-white disabled:opacity-60">{busy ? "Sending…" : label}</button>
    </form>
  );
}

function Done({ text, whatsapp, onClose }: { text: string; whatsapp: string; onClose: () => void }) {
  const tx = useT();
  return (
    <div className="text-center">
      <p className="text-4xl">✓</p>
      <p className="mt-2 font-semibold">{text}</p>
      <p className="mt-1 text-sm text-muted">{tx("We'll confirm by phone or WhatsApp.")}</p>
      <div className="mt-5 flex justify-center gap-2">
        {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white">WhatsApp us</a>}
        <button onClick={onClose} className="rounded-full border border-line px-5 py-2.5 text-sm font-bold">{tx("Close")}</button>
      </div>
      <Link href="/shop/" className="mt-4 block text-sm underline">Continue shopping</Link>
    </div>
  );
}

function BookingDialog({ service, daysAhead, openDays, whatsapp, onClose }: { service: Service; daysAhead: number; openDays: number[]; whatsapp: string; onClose: () => void }) {
  const tx = useT();
  const days = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    for (let i = 0; i <= daysAhead && out.length < 21; i++) {
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      if (openDays.includes(x.getDay())) out.push(ymd(x));
    }
    return out;
  }, [daysAhead, openDays]);
  const [date, setDate] = useState(days[0] ?? "");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [mode, setMode] = useState<"store" | "video">(service.video === "only" ? "video" : "store");
  const [callLink, setCallLink] = useState("");

  useEffect(() => {
    if (!date) return;
    setSlots(null);
    setTime("");
    fetch(`/api/services/availability/?service=${service.id}&date=${date}`).then((r) => r.json()).then((d) => setSlots(d.slots ?? [])).catch(() => setSlots([]));
  }, [date, service.id]);

  async function submit(c: { name: string; phone: string; email: string; notes: string; waOffers: boolean }) {
    if (!time) return setError("Please choose a time");
    setBusy(true);
    setError("");
    const r = await fetch("/api/bookings/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "service", refId: service.id, date, time, mode, ...c }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setDone(`${service.title} · ${fmtDate(date)} at ${time}${mode === "video" ? " · video call" : ""}`);
      if (d.booking?.mode === "video" && d.booking.link) setCallLink(d.booking.link);
    }
    else setError(d.error ?? tx("Could not book. Please try again."));
  }

  return (
    <Modal title={done ? tx("You're booked!") : `Book: ${service.title}`} onClose={onClose}>
      {done ? (
        <>
          <Done text={done} whatsapp={whatsapp} onClose={onClose} />
          {callLink && (
            <div className="mt-4 rounded-xl bg-[#faf7f8] p-4 text-sm">
              <p className="font-semibold">Your video call link</p>
              <p className="mt-1 text-muted">It opens here on our site at your time, nothing to install. We also sent it on WhatsApp.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={callLink} className="rounded-full bg-ink px-4 py-2.5 font-semibold text-white">Open my call page</a>
                <a href={`/api/bookings/ics/?id=${encodeURIComponent(callLink.split("/")[2])}&t=${encodeURIComponent(new URL(callLink, "https://x").searchParams.get("t") ?? "")}`} className="rounded-full border border-line px-4 py-2.5 font-semibold">Add to calendar</a>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted">{service.duration} min · {service.price ? money(service.price) : tx("Free")}{service.video === "only" ? " · video call from home" : ""}</p>
          {service.video === "yes" && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {([["store", "In store"], ["video", "Video call"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setMode(k)} className={`rounded-xl border py-3 text-sm font-semibold ${mode === k ? "border-black bg-black text-white" : "border-line"}`}>{k === "video" ? "🎥 " : "📍 "}{tx(l)}</button>
              ))}
            </div>
          )}
          <p className="mt-4 text-sm font-semibold">Choose a day</p>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => (
              <button key={d} onClick={() => setDate(d)} className={`shrink-0 rounded-lg border px-3 py-2 text-center text-xs ${d === date ? "border-black bg-black text-white" : "border-line"}`}>
                <span className="block font-bold">{new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" })}</span>
                {new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold">Choose a time</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {slots === null ? <p className="col-span-4 text-sm text-muted">{tx("Loading…")}</p> : slots.length === 0 ? <p className="col-span-4 text-sm text-muted">No free times this day. Try another day.</p> : slots.map((t) => (
              <button key={t} onClick={() => setTime(t)} className={`rounded-lg border py-2 text-sm ${t === time ? "border-black bg-black text-white" : "border-line hover:border-black"}`}>{t}</button>
            ))}
          </div>
          <Contact onSubmit={submit} busy={busy} error={error} label={time ? `Book ${fmtDate(date)} at ${time}` : tx("Book")} />
        </>
      )}
    </Modal>
  );
}

function RsvpDialog({ event, whatsapp, onClose }: { event: EventItem; whatsapp: string; onClose: () => void }) {
  const tx = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  async function submit(c: { name: string; phone: string; email: string; notes: string; guests: number; waOffers: boolean }) {
    setBusy(true);
    setError("");
    const r = await fetch("/api/bookings/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "event", refId: event.id, ...c }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setDone(`${event.title} · ${fmtDate(event.date)} at ${event.start}`);
    else setError(d.error ?? tx("Could not reserve. Please try again."));
  }
  return (
    <Modal title={done ? tx("See you there!") : event.title} onClose={onClose}>
      {done ? <Done text={done} whatsapp={whatsapp} onClose={onClose} /> : (
        <>
          <p className="text-sm text-muted">{fmtDate(event.date)} · {event.start}–{event.end} · {event.location}{event.price ? ` · ${money(event.price)} per guest` : " · Free"}</p>
          <Contact onSubmit={submit} busy={busy} error={error} guests label="Reserve my place" />
        </>
      )}
    </Modal>
  );
}
