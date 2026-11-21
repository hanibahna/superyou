"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClubAdjust() {
  const router = useRouter();
  const [f, setF] = useState({ phone: "", points: "", reason: "", name: "" });
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/club/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: f.phone, points: Number(f.points), reason: f.reason, name: f.name || undefined }) });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? `✓ Done — balance ${d.points} points` : d.error ?? "Failed");
    if (r.ok) router.refresh();
  }
  const box = "rounded-lg border border-line px-3 py-2 text-sm";
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-4 shadow-sm">
      <p className="w-full text-sm font-semibold">Add or remove points</p>
      <input required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Phone" className={box} />
      <input required value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} placeholder="Points (e.g. 50 or -20)" inputMode="numeric" className={`${box} w-40`} />
      <input required value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Reason (shown to the member)" className={`${box} flex-1`} />
      <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name (if not a member yet)" className={box} />
      <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">Save</button>
      {msg && <span className="w-full text-sm">{msg}</span>}
    </form>
  );
}
