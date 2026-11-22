"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type RefObject } from "react";
import { localAddresses, type Address } from "@/lib/addresses";

const MapPin = dynamic(() => import("@/components/MapPin").then((m) => m.MapPin), { ssr: false, loading: () => <div className="h-[240px] animate-pulse rounded-xl bg-[#eef1f4]" /> });

// Checkout helper: one tap fills a saved address; "Pin on map" adds the exact spot for the driver.
// Writes into the checkout form's own fields, plus hidden lat/lng.
export function CheckoutAddress({ form, setZone }: { form: RefObject<HTMLFormElement | null>; setZone: (z: string) => void }) {
  const [saved, setSaved] = useState<Address[]>([]);
  const [picked, setPicked] = useState<string>("");
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | undefined>();
  useEffect(() => setSaved(localAddresses()), []);

  const field = (name: string) => form.current?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  const put = (name: string, v: string) => { const el = field(name); if (el) el.value = v; };
  const use = (a: Address) => {
    setPicked(a.id);
    if (a.zone) setZone(a.zone);
    put("city", a.city);
    put("address", a.address);
    put("notes", a.notes ?? "");
    put("addressLabel", a.label);
    setPin(a.lat && a.lng ? { lat: a.lat, lng: a.lng } : undefined);
    setPinOpen(false);
  };

  return (
    <div className="mb-3 min-w-0 max-w-full space-y-3">
      {saved.length > 0 && (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {saved.map((a) => (
            <button type="button" key={a.id} onClick={() => use(a)} className={`min-w-[150px] shrink-0 rounded-xl border p-3 text-left text-sm ${picked === a.id ? "border-ink ring-1 ring-ink" : "border-line"}`}>
              <span className="font-semibold">{a.label}{a.lat ? " 📍" : ""}</span>
              <span className="mt-0.5 block truncate text-xs text-muted">{a.address}, {a.city}</span>
            </button>
          ))}
        </div>
      )}
      <input type="hidden" name="lat" value={pin?.lat ?? ""} readOnly />
      <input type="hidden" name="lng" value={pin?.lng ?? ""} readOnly />
      <input type="hidden" name="addressLabel" defaultValue="" />
      <button type="button" onClick={() => setPinOpen(!pinOpen)} className="w-full rounded-xl bg-[#faf7f8] px-4 py-3 text-left text-sm font-semibold">
        {pin ? "📍 Location pinned · change" : "📍 Pin my location on the map (recommended)"}
      </button>
      {pinOpen && (
        <MapPin
          value={pin}
          onChange={(p, g) => {
            setPin(p);
            if (g.city && !field("city")?.value) put("city", g.city);
            if (g.street && !field("address")?.value) put("address", g.street);
          }}
        />
      )}
    </div>
  );
}
