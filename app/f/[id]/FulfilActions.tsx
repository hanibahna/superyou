"use client";

import { useEffect, useState } from "react";

/** Buttons on the parcel page: supplier → Print + Ready for pickup; courier → Picked up, then Delivered with a photo. */
export function FulfilActions({ id, t, role, stage: initial, pod, po }: { id: string; t: string; role: "s" | "c"; stage: string; pod?: string; po: string }) {
  const [stage, setStage] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
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
              <button disabled={busy || !photo} onClick={async () => photo && send("delivered", await shrink(photo))} className={`${big} bg-[#046c4e] text-white`}>{busy ? "Sending…" : "✓ Delivered"}</button>
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

/** Phone photos are several MB: resize to 1280 px JPEG before sending (fast on mobile data, small to keep). */
async function shrink(f: File): Promise<File> {
  try {
    const img = await createImageBitmap(f);
    const k = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.72));
    return b ? new File([b], "delivery.jpg", { type: "image/jpeg" }) : f;
  } catch {
    return f;
  }
}

/** Prints just one part of the page (the purchase order or the parcel label). */
export function PrintButton({ target, label }: { target: "po" | "label"; label: string }) {
  return (
    <button
      onClick={() => { document.body.dataset.print = target; window.print(); setTimeout(() => delete document.body.dataset.print, 500); }}
      className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-full border-2 border-ink font-bold print:hidden"
    >{label}</button>
  );
}

/** Label scanned: the delivery details are sent to the courier's WhatsApp (never shown here). */
export function ScanNotice({ id }: { id: string }) {
  const [state, setState] = useState<"" | "sent" | "recent" | "error">("");
  const [err, setErr] = useState("");
  useEffect(() => {
    const fd = new FormData();
    fd.set("action", "scan");
    fetch(`/api/fulfil/${encodeURIComponent(id)}/`, { method: "POST", body: fd }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (r.ok) setState(d.result === "recent" ? "recent" : "sent");
      else (setState("error"), setErr(d.error ?? "Could not send"));
    }).catch(() => setState("error"));
  }, [id]);
  return (
    <p className={`mt-6 rounded-xl p-4 text-sm font-semibold ${state === "error" ? "bg-[#fdecef] text-[#9b2c50]" : "bg-[#e6f4ee] text-[#046c4e]"}`}>
      {state === "" ? "Sending the delivery details…" : state === "error" ? err : "✓ The delivery details were sent to the courier's WhatsApp."}
    </p>
  );
}
