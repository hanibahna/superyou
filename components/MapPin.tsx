"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

// Drop a pin on the map (OpenStreetMap, no key needed). Drag the pin or tap the map; "Use my location"
// centres on the phone's GPS. Suggests the area and street from the pin (OpenStreetMap Nominatim).
export type Pin = { lat: number; lng: number };
export type PinGuess = { city?: string; street?: string };

const BEIRUT: Pin = { lat: 33.8938, lng: 35.5018 };

export function MapPin({ value, onChange, height = 260 }: { value?: Pin; onChange: (p: Pin, guess: PinGuess) => void; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState("");
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !box.current || map.current) return;
      const start = value ?? BEIRUT;
      const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], value ? 17 : 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      const icon = L.divIcon({ className: "", html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#c0587a;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>', iconSize: [28, 28], iconAnchor: [14, 28] });
      const mk = L.marker([start.lat, start.lng], { draggable: true, icon, opacity: value ? 1 : 0.55 }).addTo(m);
      const set = (lat: number, lng: number) => {
        mk.setLatLng([lat, lng]).setOpacity(1);
        guess(lat, lng).then((g) => cb.current({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) }, g));
      };
      mk.on("dragend", () => { const p = mk.getLatLng(); set(p.lat, p.lng); });
      m.on("click", (e) => set(e.latlng.lat, e.latlng.lng));
      map.current = m;
      marker.current = mk;
      setTimeout(() => m.invalidateSize(), 200);
    })();
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locate = () => {
    if (!navigator.geolocation) return setErr("Location isn't available on this device.");
    setLocating(true);
    setErr("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        const { latitude: lat, longitude: lng } = p.coords;
        map.current?.setView([lat, lng], 17);
        marker.current?.setLatLng([lat, lng]).setOpacity(1);
        guess(lat, lng).then((g) => cb.current({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) }, g));
      },
      () => (setLocating(false), setErr("We couldn't get your location. Drag the pin instead.")),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  return (
    <div>
      <div className="relative isolate overflow-hidden rounded-xl border border-line">
        <div ref={box} style={{ height }} className="z-0 w-full bg-[#eef1f4]" />
        <button type="button" onClick={locate} className="absolute bottom-3 left-1/2 z-[500] -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          {locating ? "Finding you…" : "◎ Use my location"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted">{err || "Tap the map or drag the pin to your door, so the driver finds you first time."}</p>
    </div>
  );
}

async function guess(lat: number, lng: number): Promise<PinGuess> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=en`, { headers: { Accept: "application/json" } });
    const j = (await r.json()) as { address?: Record<string, string> };
    const a = j.address ?? {};
    return {
      city: a.suburb || a.neighbourhood || a.village || a.town || a.city_district || a.city || undefined,
      street: [a.road, a.house_number].filter(Boolean).join(" ") || undefined,
    };
  } catch {
    return {};
  }
}

export const mapsLink = (p: Pin) => `https://www.google.com/maps?q=${p.lat},${p.lng}`;
