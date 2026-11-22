"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

// The customer's video call, inside our own page: the provider's room is embedded here.
type Info = { id: string; title: string; date: string; time: string; duration: number; name: string; status: string; mode: string; startsAt: number; opensAt: number; roomUrl: string | null; ready: boolean };

export default function CallPage() {
  return <Suspense fallback={<p className="container-x py-16 text-muted">Loading…</p>}><Call /></Suspense>;
}

function Call() {
  const { id } = useParams<{ id: string }>();
  const t = useSearchParams().get("t") ?? "";
  const [info, setInfo] = useState<Info | null>(null);
  const [missing, setMissing] = useState(false);
  const [now, setNow] = useState(() => Date.now() / 1000);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const load = () => fetch(`/api/bookings/call/?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setInfo).catch(() => setMissing(true));
    load();
    const a = setInterval(() => setNow(Date.now() / 1000), 1000);
    const b = setInterval(load, 30000); // the room opens a few minutes before the start
    return () => (clearInterval(a), clearInterval(b));
  }, [id, t]);

  if (missing) return <p className="container-x py-16 text-center text-muted">We couldn't find this appointment. Check the link in your WhatsApp message.</p>;
  if (!info) return <p className="container-x py-16 text-muted">Loading…</p>;

  const when = new Date(info.startsAt * 1000).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Beirut" });
  const wait = Math.max(0, Math.round(info.opensAt - now));
  const ics = `/api/bookings/ics/?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`;

  if (joined && info.roomUrl)
    return (
      <div className="container-x py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-semibold">{info.title}</p>
          <button onClick={() => setJoined(false)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold">Leave call</button>
        </div>
        <iframe src={info.roomUrl} title="Video call" allow="camera; microphone; fullscreen; speaker; display-capture; autoplay; clipboard-write" className="h-[78vh] w-full rounded-2xl border border-line bg-black" />
      </div>
    );

  return (
    <div className="container-x max-w-xl py-12 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-600">{info.mode === "video" ? "Video call" : "Appointment"}</p>
      <h1 className="mt-2 text-3xl font-semibold">{info.title}</h1>
      <p className="mt-2 text-muted">Hi {info.name}, {when} (Beirut time) · {info.duration} min</p>
      {info.status === "cancelled" ? (
        <p className="mt-8 rounded-xl bg-red-50 p-4 text-sale">This appointment was cancelled.</p>
      ) : info.mode !== "video" ? (
        <p className="mt-8 text-sm">See you at the store.</p>
      ) : info.roomUrl ? (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-muted">Allow your camera and microphone when your browser asks. Nothing to install.</p>
          <button onClick={() => setJoined(true)} className="w-full rounded-full bg-ink py-4 font-semibold text-white">Join the video call</button>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl bg-[#faf7f8] p-6">
          <p className="text-sm text-muted">{info.ready ? "The call opens a few minutes before the start." : "We'll confirm your call shortly on WhatsApp."}</p>
          {info.ready && wait > 0 && <p className="mt-3 font-mono text-3xl font-bold">{fmt(wait)}</p>}
        </div>
      )}
      <a href={ics} className="mt-6 inline-block rounded-full border border-line px-5 py-3 text-sm font-semibold">Add to my calendar</a>
    </div>
  );
}

function fmt(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return d ? `${d}d ${h}h ${m}m` : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}`;
}
