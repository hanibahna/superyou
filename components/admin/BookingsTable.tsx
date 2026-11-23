"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Booking } from "@/lib/services";

const statuses: Booking["status"][] = ["pending", "confirmed", "done", "no-show", "cancelled"];
const color: Record<Booking["status"], string> = { pending: "bg-amber-100 text-amber-800", confirmed: "bg-green-100 text-green-800", done: "bg-line text-ink", "no-show": "bg-red-100 text-red-700", cancelled: "bg-line text-muted line-through" };

export function BookingsTable({ bookings }: { bookings: Booking[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<"all" | "service" | "event">("all");
  const [when, setWhen] = useState<"upcoming" | "past" | "all">("upcoming");
  const today = new Date().toISOString().slice(0, 10);
  const list = bookings
    .filter((b) => kind === "all" || b.kind === kind)
    .filter((b) => when === "all" || (when === "upcoming" ? b.date >= today : b.date < today))
    .sort((a, b) => (when === "past" ? -1 : 1) * `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  async function setStatus(id: string, status: Booking["status"]) {
    await fetch(`/api/admin/bookings/${id}/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    router.refresh();
  }
  const wa = (b: Booking) => {
    const n = b.phone.replace(/\D/g, "").replace(/^0/, "961");
    const msg = `Hello ${b.name}, this is SuperYou confirming your ${b.kind === "event" ? "place at" : "booking for"} ${b.title} on ${b.date} at ${b.time}. See you soon!`;
    return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
  };
  const csv = () => {
    const rows = [["id", "type", "title", "date", "time", "name", "phone", "email", "guests", "status", "notes"], ...list.map((b) => [b.id, b.kind, b.title, b.date, b.time, b.name, b.phone, b.email, String(b.guests), b.status, b.notes])];
    const blob = new Blob(["﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bookings.csv";
    a.click();
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bookings & sign-ups</h1>
          <p className="text-sm text-muted">{bookings.filter((b) => b.status === "pending").length} waiting for confirmation</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {(["upcoming", "past", "all"] as const).map((w) => <button key={w} onClick={() => setWhen(w)} className={`rounded-full px-3 py-1.5 capitalize ${when === w ? "bg-ink text-white" : "bg-white"}`}>{w}</button>)}
          <span className="w-2" />
          {(["all", "service", "event"] as const).map((k) => <button key={k} onClick={() => setKind(k)} className={`rounded-full px-3 py-1.5 capitalize ${kind === k ? "bg-ink text-white" : "bg-white"}`}>{k === "all" ? "Everything" : k + "s"}</button>)}
          <button onClick={csv} className="rounded-full border border-line bg-white px-3 py-1.5">Download CSV</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase text-muted">
            <tr><th className="p-3">When</th><th className="p-3">What</th><th className="p-3">Customer</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted">No bookings here yet.</td></tr>}
            {list.map((b) => (
              <tr key={b.id}>
                <td className="whitespace-nowrap p-3"><b>{new Date(`${b.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</b><br />{b.time}</td>
                <td className="p-3">{b.title}<br /><span className="text-xs text-muted">{b.kind === "event" ? `Event · ${b.guests} guest(s)` : b.kind === "clinic" ? `Clinic request · date to confirm` : `Service · ${b.duration} min`}</span></td>
                <td className="p-3">{b.name}<br /><a href={`tel:${b.phone}`} className="text-xs text-brand-600">{b.phone}</a>{b.notes && <p className="mt-1 max-w-xs text-xs text-muted">“{b.notes}”</p>}</td>
                <td className="p-3">
                  <select value={b.status} onChange={(e) => setStatus(b.id, e.target.value as Booking["status"])} className={`rounded-full px-2 py-1 text-xs font-semibold ${color[b.status]}`}>
                    {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-3 text-right"><a href={wa(b)} target="_blank" rel="noreferrer" className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white">WhatsApp</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
