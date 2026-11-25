"use client";

import { useEffect, useState } from "react";

/** Buttons on the parcel page: supplier → Print + Ready for pickup; courier → Picked up, then Delivered with a photo. */
export function FulfilActions({ id, t, role, stage: initial, pod, po, remember }: { id: string; t: string; role: "s" | "c"; stage: string; pod?: string; po: string; remember?: boolean }) {
  const [stage, setStage] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  // The courier opened their link: remember this phone, so scanning any label later opens the delivery details.
  useEffect(() => {
    if (!remember) return;
    const fd = new FormData();
    fd.set("t", t); fd.set("r", "c"); fd.set("action", "remember");
    fetch(`/api/fulfil/${encodeURIComponent(id)}/`, { method: "POST", body: fd }).catch(() => {});
  }, [remember, id, t]);
  const send = async (action: string, file?: File) => {
    setBusy(true);
    setErr("");
    const fd = new FormData();
    fd.set("t", t); fd.set("r", role); fd.set("action", action);
    if (file) fd.set("photo", file);
    const r = await fetch(`/api/fulfil/${encodeURIComponent(id)}/`, { method: "POST", body: fd }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return setErr(d.error ?? "Something went wrong, please try again");
    setStage(d.stage ?? stage);
  };
  const big = "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full text-base font-bold disabled:opacity-50";
  return (
    <div className="mt-5 space-y-3 print:hidden">
      {role === "s" && (
        <>
          <button onClick={() => window.print()} className={`${big} border-2 border-ink`}>🖨️ Print label (10 × 15 cm)</button>
          {stage === "sent" ? (
            <button disabled={busy} onClick={() => send("ready")} className={`${big} bg-[#046c4e] text-white`}>{busy ? "…" : "✓ Packed — ready for pickup"}</button>
          ) : (
            <p className="rounded-xl bg-[#e6f4ee] p-3 text-center font-semibold text-[#046c4e]">✓ Marked ready. The courier has been told.</p>
          )}
        </>
      )}
      {role === "c" && (
        <>
          {(stage === "sent" || stage === "ready") && (
            <button disabled={busy} onClick={() => send("picked")} className={`${big} bg-ink text-white`}>{busy ? "…" : "📦 Picked up"}</button>
          )}
          {stage === "picked" && (
            <div className="space-y-2 rounded-xl border border-line p-3">
              <p className="font-semibold">Delivered? Take a photo of the parcel with the customer.</p>
              <label className={`${big} cursor-pointer border-2 border-dashed border-ink`}>
                📷 {photo ? `Photo ready: ${photo.name.slice(0, 24)}` : "Take photo"}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
              </label>
              <button disabled={busy || !photo} onClick={() => photo && send("delivered", photo)} className={`${big} bg-[#046c4e] text-white`}>{busy ? "Sending…" : "✓ Delivered"}</button>
              <p className="text-center text-xs text-muted">No signal? Send the photo on WhatsApp to SuperYou with &quot;{po}&quot; in the message.</p>
            </div>
          )}
          {stage === "delivered" && (
            <div className="rounded-xl bg-[#e6f4ee] p-3 text-center font-semibold text-[#046c4e]">
              ✓ Delivered. Thank you!
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {pod && <img src={pod} alt="Proof of delivery" className="mx-auto mt-2 max-h-56 rounded-lg" />}
            </div>
          )}
        </>
      )}
      {err && <p className="text-center text-sm text-[#b42318]">{err}</p>}
    </div>
  );
}
