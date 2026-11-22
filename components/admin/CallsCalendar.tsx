"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, Select, Text, useSaver } from "./fields";

type Item = { id: string; title: string; date: string; time: string; duration: number; name: string; phone: string; status: string; mode: string; hasRoom: boolean; notes: string };
type Video = { provider: "" | "daily" | "whereby"; dailyKey: string; wherebyKey: string; openBefore: number };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const tone: Record<string, string> = { pending: "bg-amber-100 text-amber-900", confirmed: "bg-green-100 text-green-900", done: "bg-gray-100 text-gray-600", "no-show": "bg-red-100 text-red-800" };

export function CallsCalendar({ items, video }: { items: Item[]; video: Video }) {
  const [v, setV] = useState(video);
  const saver = useSaver("/api/admin/video/");
  const [week, setWeek] = useState(0);
  const [onlyVideo, setOnlyVideo] = useState(false);
  const days = useMemo(() => {
    const start = new Date(); start.setHours(12, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + week * 7);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [week]);
  const shown = items.filter((x) => !onlyVideo || x.mode === "video");
  const requests = items.filter((x) => x.status === "pending").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const setStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/bookings/${id}/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    location.reload();
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Calls & appointments</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">Every booked consultation, in store or by video. Video calls open inside the site for the customer and inside this panel for you: nobody installs anything or leaves the site.</p>

      <div className="mt-5 space-y-5">
        <Card title={`Requests waiting (${requests.length})`} sub="Confirm to send the WhatsApp confirmation (with the call link for video calls).">
          {!requests.length ? <p className="text-sm text-muted">None.</p> : (
            <ul className="divide-y divide-line">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.mode === "video" ? "bg-indigo-100 text-indigo-900" : "bg-gray-100"}`}>{r.mode === "video" ? "🎥 Video" : "📍 Store"}</span>
                  <span className="min-w-0 flex-1"><b>{r.name}</b> · {r.title} · {r.date} {r.time}{r.notes ? <span className="text-muted"> · “{r.notes}”</span> : null}</span>
                  <a href={`https://wa.me/${r.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-2 font-semibold">WhatsApp</a>
                  <button onClick={() => setStatus(r.id, "confirmed")} className="rounded-lg bg-ink px-3 py-2 font-semibold text-white">Confirm</button>
                  <button onClick={() => setStatus(r.id, "cancelled")} className="rounded-lg px-3 py-2 text-sale">Decline</button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Calendar" actions={
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={onlyVideo} onChange={(e) => setOnlyVideo(e.target.checked)} /> Video only</label>
            <button onClick={() => setWeek(week - 1)} className="rounded-lg border border-line px-3 py-1.5">‹</button>
            <button onClick={() => setWeek(0)} className="rounded-lg border border-line px-3 py-1.5">This week</button>
            <button onClick={() => setWeek(week + 1)} className="rounded-lg border border-line px-3 py-1.5">›</button>
          </div>
        }>
          <div className="-mx-1 overflow-x-auto">
            <div className="grid min-w-[840px] grid-cols-7 gap-2 px-1">
              {days.map((d) => {
                const key = iso(d);
                const list = shown.filter((x) => x.date === key).sort((a, b) => a.time.localeCompare(b.time));
                const today = key === iso(new Date());
                return (
                  <div key={key} className={`min-h-[180px] rounded-xl border p-2 ${today ? "border-ink" : "border-line"}`}>
                    <p className="mb-2 text-xs font-bold">{d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
                    <div className="space-y-1.5">
                      {list.map((x) => (
                        <div key={x.id} className="rounded-lg bg-[#faf7f8] p-2 text-xs">
                          <p className="font-semibold">{x.time} · {x.mode === "video" ? "🎥" : "📍"} {x.name}</p>
                          <p className="truncate text-muted">{x.title}</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tone[x.status] ?? ""}`}>{x.status}</span>
                            {x.mode === "video" && x.hasRoom && <Link href={`/admin/calls/${x.id}/`} className="font-semibold text-brand-700 underline">Join</Link>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card title="Video provider" sub="The provider hosts the video; the call shows inside our pages. Pick one and paste its API key. Both have a free tier to start.">
          <div className="grid gap-3 md:grid-cols-2">
            <Select label="Provider" value={v.provider} onChange={(provider) => (saver.touch(), setV({ ...v, provider }))} options={[["", "Not set up"], ["daily", "Daily (daily.co)"], ["whereby", "Whereby Embedded"]]} />
            <Text label="Open the call this many minutes early" value={String(v.openBefore)} onChange={(x) => (saver.touch(), setV({ ...v, openBefore: Number(x.replace(/\D/g, "")) || 0 }))} />
            {v.provider === "daily" && <Text label="Daily API key" type="password" hint={<a href="https://dashboard.daily.co/developers" target="_blank" rel="noreferrer" className="underline">dashboard.daily.co → Developers</a>} value={v.dailyKey} onChange={(dailyKey) => (saver.touch(), setV({ ...v, dailyKey }))} className="md:col-span-2" />}
            {v.provider === "whereby" && <Text label="Whereby API key" type="password" hint={<a href="https://whereby.com/information/embedded" target="_blank" rel="noreferrer" className="underline">Whereby Embedded dashboard → Configure → API</a>} value={v.wherebyKey} onChange={(wherebyKey) => (saver.touch(), setV({ ...v, wherebyKey }))} className="md:col-span-2" />}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => saver.save(v)} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">Save</button>
            <span className="text-xs text-muted">{saver.msg?.text ?? (saver.dirty ? "Unsaved changes" : "")}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
