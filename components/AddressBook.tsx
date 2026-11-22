"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { newAddressId, type Address } from "@/lib/addresses";
import { useSettings } from "@/lib/site-context";

const MapPin = dynamic(() => import("@/components/MapPin").then((m) => m.MapPin), { ssr: false, loading: () => <div className="h-[260px] animate-pulse rounded-xl bg-[#eef1f4]" /> });

const LABELS = ["Home", "Work", "Family", "Other"];
const input = "w-full rounded-lg border border-line px-3 py-3 text-base outline-none focus:border-ink sm:text-sm";

/** Edit one address: label, area, street and a map pin. */
export function AddressForm({ initial, onSave, onCancel, saveLabel = "Save address" }: { initial?: Partial<Address>; onSave: (a: Address) => void; onCancel?: () => void; saveLabel?: string }) {
  const settings = useSettings();
  const zones = settings.delivery.zones;
  const [a, setA] = useState<Address>({ id: initial?.id || newAddressId(), label: initial?.label || "Home", zone: initial?.zone || zones[0]?.name || "", city: initial?.city || "", address: initial?.address || "", notes: initial?.notes || "", lat: initial?.lat, lng: initial?.lng });
  const [err, setErr] = useState("");
  const set = (p: Partial<Address>) => setA((x) => ({ ...x, ...p }));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {LABELS.map((l) => (
          <button type="button" key={l} onClick={() => set({ label: l })} className={`rounded-full px-4 py-2 text-sm font-semibold ${a.label === l ? "bg-ink text-white" : "bg-white ring-1 ring-line"}`}>{l}</button>
        ))}
      </div>
      <MapPin value={a.lat && a.lng ? { lat: a.lat, lng: a.lng } : undefined} onChange={(p, g) => set({ lat: p.lat, lng: p.lng, city: a.city || g.city || "", address: a.address || g.street || "" })} />
      <div className="grid gap-3 sm:grid-cols-2">
        {zones.length > 0 && (
          <select value={a.zone} onChange={(e) => set({ zone: e.target.value })} className={input} aria-label="Delivery area">
            {zones.map((z) => <option key={z.name} value={z.name}>{z.name}</option>)}
          </select>
        )}
        <input value={a.city} onChange={(e) => set({ city: e.target.value })} placeholder="Town / neighbourhood" className={input} aria-label="Town" />
        <input value={a.address} onChange={(e) => set({ address: e.target.value })} placeholder="Street, building, floor, landmark" className={`${input} sm:col-span-2`} aria-label="Address" />
        <input value={a.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="Notes for the driver (optional)" className={`${input} sm:col-span-2`} aria-label="Notes" />
      </div>
      {err && <p className="text-sm text-sale">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => (a.address.trim().length < 3 || !a.city.trim() ? setErr("Please add the town and the street or building.") : onSave({ ...a, address: a.address.trim(), city: a.city.trim() }))} className="flex-1 rounded-full bg-ink py-3 font-semibold text-white sm:flex-none sm:px-6">{saveLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-full px-5 py-3 font-semibold ring-1 ring-line">Cancel</button>}
      </div>
    </div>
  );
}

/** A list of saved addresses with add / edit / remove. */
export function AddressBook({ addresses, onChange, busy }: { addresses: Address[]; onChange: (list: Address[]) => void; busy?: boolean }) {
  const [editing, setEditing] = useState<string | "new" | null>(addresses.length ? null : "new");
  return (
    <div className="space-y-3">
      {addresses.map((a) =>
        editing === a.id ? (
          <div key={a.id} className="rounded-2xl border border-line p-4">
            <AddressForm initial={a} onSave={(n) => (onChange(addresses.map((x) => (x.id === a.id ? n : x))), setEditing(null))} onCancel={() => setEditing(null)} />
          </div>
        ) : (
          <div key={a.id} className="flex items-start gap-3 rounded-2xl border border-line p-4">
            <span className="mt-0.5 rounded-full bg-[#faf7f8] px-2.5 py-1 text-xs font-semibold">{a.label}</span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{a.address}</p>
              <p className="text-muted">{[a.city, a.zone].filter(Boolean).join(" · ")}{a.lat ? " · 📍 pinned" : ""}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
              <button type="button" onClick={() => setEditing(a.id)} className="px-2 py-1 font-semibold text-brand-700">Edit</button>
              <button type="button" onClick={() => onChange(addresses.filter((x) => x.id !== a.id))} className="px-2 py-1 text-muted">Remove</button>
            </div>
          </div>
        ),
      )}
      {editing === "new" ? (
        <div className="rounded-2xl border border-line p-4">
          <AddressForm initial={{ label: addresses.length ? "Work" : "Home" }} onSave={(n) => (onChange([...addresses, n]), setEditing(null))} onCancel={addresses.length ? () => setEditing(null) : undefined} saveLabel="Add address" />
        </div>
      ) : (
        addresses.length < 10 && <button type="button" disabled={busy} onClick={() => setEditing("new")} className="w-full rounded-2xl border-2 border-dashed border-line py-3.5 text-sm font-semibold">+ Add another address</button>
      )}
    </div>
  );
}
