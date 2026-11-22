"use client";

import { useState } from "react";
import type { EventItem, Service, ServicesConfig } from "@/lib/services";
import { Area, Card, CatalogPick, Header, MediaField, Num, Text, Toggle, move, useSaver, Select } from "./fields";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || `item-${Date.now().toString(36)}`;

export function ServicesEditor({ initial }: { initial: ServicesConfig }) {
  const [c, setC] = useState<ServicesConfig>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const saver = useSaver("/api/admin/services/");
  const up = (p: Partial<ServicesConfig>) => (saver.touch(), setC({ ...c, ...p }));
  const upS = (i: number, p: Partial<Service>) => up({ services: c.services.map((s, n) => (n === i ? { ...s, ...p } : s)) });
  const upE = (i: number, p: Partial<EventItem>) => up({ events: c.events.map((s, n) => (n === i ? { ...s, ...p } : s)) });

  return (
    <div>
      <Header title="Services & events" sub="Bookable in-store services and events at /services — bookings arrive in Bookings & sign-ups" saver={saver} onSave={() => saver.save(c)} extra={<a href="/services/" target="_blank" className="text-sm text-brand-600 hover:underline">View page ↗</a>} />
      <div className="space-y-5">
        <Card title="Booking rules">
          <div className="grid gap-4 md:grid-cols-3">
            <Toggle label="Services & events page is live" checked={c.enabled} onChange={(enabled) => up({ enabled })} />
            <Text label="Location" value={c.location} onChange={(location) => up({ location })} />
            <Area label="Introduction" rows={2} value={c.intro} onChange={(intro) => up({ intro })} />
            <Num label="Start times every (min)" value={c.step} onChange={(step) => up({ step })} />
            <Num label="Appointments at the same time" hint="How many advisors can take bookings in parallel" value={c.staff} onChange={(staff) => up({ staff })} />
            <Num label="Earliest booking (hours from now)" value={c.leadHours} onChange={(leadHours) => up({ leadHours })} />
            <Num label="Bookable days ahead" value={c.daysAhead} onChange={(daysAhead) => up({ daysAhead })} />
          </div>
          <p className="mb-2 mt-5 text-sm font-medium">Opening hours for appointments</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {days.map((d, day) => {
              const h = c.hours.find((x) => x.day === day);
              return (
                <div key={d} className="flex items-center gap-2 rounded-lg border border-line p-2 text-sm">
                  <input type="checkbox" checked={!!h} onChange={(e) => up({ hours: e.target.checked ? [...c.hours, { day, open: "10:00", close: "19:00" }] : c.hours.filter((x) => x.day !== day) })} />
                  <span className="w-20">{d.slice(0, 3)}</span>
                  {h ? (
                    <>
                      <input type="time" value={h.open} onChange={(e) => up({ hours: c.hours.map((x) => (x.day === day ? { ...x, open: e.target.value } : x)) })} className="w-20 rounded border border-line px-1" />
                      –<input type="time" value={h.close} onChange={(e) => up({ hours: c.hours.map((x) => (x.day === day ? { ...x, close: e.target.value } : x)) })} className="w-20 rounded border border-line px-1" />
                    </>
                  ) : <span className="text-muted">Closed</span>}
                </div>
              );
            })}
          </div>
        </Card>

        <Card title={`Services (${c.services.length})`} actions={<button onClick={() => { const s: Service = { id: slug(`service-${c.services.length + 1}`), title: "New service", category: "Skin care", description: "", duration: 30, price: 0, priceNote: "Complimentary", image: "", enabled: true }; up({ services: [...c.services, s] }); setOpen(s.id); }} className="rounded-lg bg-ink px-3 py-1.5 text-sm text-white">+ New service</button>}>
          <ul className="divide-y divide-line">
            {c.services.map((s, i) => (
              <li key={s.id} className={s.enabled ? "" : "opacity-60"}>
                <div className="flex items-center gap-2 py-2 text-sm">
                  <button onClick={() => setOpen(open === s.id ? null : s.id)} className="flex-1 text-left"><b>{s.title}</b> <span className="text-muted">· {s.category} · {s.duration} min · {s.price ? `$${s.price}` : "free"}</span></button>
                  <Toggle label="" checked={s.enabled} onChange={(enabled) => upS(i, { enabled })} />
                  <button disabled={i === 0} onClick={() => up({ services: move(c.services, i, -1) })} className="px-1 disabled:opacity-30">↑</button>
                  <button disabled={i === c.services.length - 1} onClick={() => up({ services: move(c.services, i, 1) })} className="px-1 disabled:opacity-30">↓</button>
                  <button onClick={() => window.confirm("Delete this service?") && up({ services: c.services.filter((_, n) => n !== i) })} className="px-1 text-sale">✕</button>
                </div>
                {open === s.id && (
                  <div className="mb-3 grid gap-3 rounded-lg bg-[#fafafa] p-4 md:grid-cols-2">
                    <Text label="Name" value={s.title} onChange={(title) => upS(i, { title })} />
                    <Text label="Category" value={s.category} onChange={(category) => upS(i, { category })} />
                    <Area label="Description" value={s.description} onChange={(description) => upS(i, { description })} className="md:col-span-2" />
                    <Num label="Duration (min)" value={s.duration} onChange={(duration) => upS(i, { duration })} />
                    <Num label="Price ($, 0 = free)" step={0.5} value={s.price} onChange={(price) => upS(i, { price })} />
                    <Text label="Price note" value={s.priceNote} onChange={(priceNote) => upS(i, { priceNote })} />
                    <Select label="Where" value={s.video ?? "no"} onChange={(video) => upS(i, { video })} options={[["no", "In store"], ["yes", "In store or video call (customer chooses)"], ["only", "Video call only"]]} />
                    <div className="grid gap-2"><CatalogPick onPick={(image) => upS(i, { image })} /><MediaField label="Picture" value={s.image} onChange={(image) => upS(i, { image })} /></div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Events (${c.events.length})`} actions={<button onClick={() => { const e: EventItem = { id: slug(`event-${Date.now().toString(36)}`), title: "New event", description: "", date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), start: "18:00", end: "20:00", location: c.location, image: "", capacity: 30, price: 0, enabled: true }; up({ events: [...c.events, e] }); setOpen(e.id); }} className="rounded-lg bg-ink px-3 py-1.5 text-sm text-white">+ New event</button>}>
          <ul className="divide-y divide-line">
            {[...c.events].map((e, i) => (
              <li key={e.id} className={e.enabled ? "" : "opacity-60"}>
                <div className="flex items-center gap-2 py-2 text-sm">
                  <button onClick={() => setOpen(open === e.id ? null : e.id)} className="flex-1 text-left"><b>{e.title}</b> <span className="text-muted">· {e.date} {e.start}–{e.end} · {e.capacity ? `${e.capacity} places` : "unlimited"}</span></button>
                  <Toggle label="" checked={e.enabled} onChange={(enabled) => upE(i, { enabled })} />
                  <button onClick={() => window.confirm("Delete this event?") && up({ events: c.events.filter((_, n) => n !== i) })} className="px-1 text-sale">✕</button>
                </div>
                {open === e.id && (
                  <div className="mb-3 grid gap-3 rounded-lg bg-[#fafafa] p-4 md:grid-cols-2">
                    <Text label="Title" value={e.title} onChange={(title) => upE(i, { title })} />
                    <Text label="Location" value={e.location} onChange={(location) => upE(i, { location })} />
                    <Area label="Description" value={e.description} onChange={(description) => upE(i, { description })} className="md:col-span-2" />
                    <Text type="date" label="Date" value={e.date} onChange={(date) => upE(i, { date })} />
                    <div className="grid grid-cols-2 gap-2"><Text type="time" label="Starts" value={e.start} onChange={(start) => upE(i, { start })} /><Text type="time" label="Ends" value={e.end} onChange={(end) => upE(i, { end })} /></div>
                    <Num label="Places (0 = unlimited)" value={e.capacity} onChange={(capacity) => upE(i, { capacity })} />
                    <Num label="Price per guest ($, 0 = free)" step={0.5} value={e.price} onChange={(price) => upE(i, { price })} />
                    <div className="grid gap-2 md:col-span-2"><CatalogPick onPick={(image) => upE(i, { image })} /><MediaField label="Picture" value={e.image} onChange={(image) => upE(i, { image })} /></div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
