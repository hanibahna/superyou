"use client";

import { useT } from "@/lib/site-context";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PharmacistButton } from "@/components/Growth";
import { ProductCard } from "@/components/ProductCard";
import type { CardItem } from "@/lib/listing";
import { useShop } from "@/lib/store";

type Step = { id: string; name: string; time: string; tip: string; picks: CardItem[] };
type Analysis = { skinType?: string; concerns: string[]; sensitive: boolean; observations: string[]; advice: string; zones?: { zone: string; note: string }[]; confidence?: "high" | "medium" | "low"; photoTips?: string; redFlags?: string[] };

/** Opens any photo the phone gives us (iPhone HEIC included), upright, as an image we can draw. */
async function decode(file: File): Promise<{ src: CanvasImageSource; w: number; h: number }> {
  try {
    const b = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { src: b, w: b.width, h: b.height };
  } catch {
    // Safari can't always make a bitmap from HEIC, but an <img> can show it.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    return { src: img, w: img.naturalWidth, h: img.naturalHeight };
  }
}

/** Shrinks the photo in the browser (max 1024 px JPEG) before upload. */
async function shrink(file: File) {
  const { src, w, h } = await decode(file);
  if (!w || !h) throw new Error("empty");
  const k = Math.min(1, 1024 / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

/** Average brightness 0–255 of a picture, to warn about photos that are too dark or too bright. */
function brightness(data: string): Promise<number> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 48; c.height = 64;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0, 48, 64);
      const d = g.getImageData(8, 8, 32, 40).data; // middle of the frame, where the face is
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      res(sum / (d.length / 4));
    };
    img.onerror = () => res(128);
    img.src = data;
  });
}

/** Live selfie camera: front camera, mirrored preview, oval face guide and a 3-second countdown. */
function SelfieCamera({ onShot, onClose }: { onShot: (data: string) => void; onClose: () => void }) {
  const tx = useT();
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");
  const [count, setCount] = useState(0);
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((s) => { stream = s; if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); } })
      .catch(() => setErr(tx("We couldn't open your camera. Allow camera access in your browser settings, or upload a photo instead.")));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [tx]);
  const snap = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    // Portrait 3:4 crop from the middle, un-mirrored (the analysis needs the real face, not the mirror image).
    const h = v.videoHeight, w = Math.min(v.videoWidth, Math.round((h * 3) / 4));
    const k = Math.min(1, 1024 / h);
    const c = document.createElement("canvas");
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext("2d")!.drawImage(v, (v.videoWidth - w) / 2, 0, w, h, 0, 0, c.width, c.height);
    onShot(c.toDataURL("image/jpeg", 0.88));
  };
  const start = () => {
    setCount(3);
    let n = 3;
    const t = setInterval(() => { n -= 1; setCount(n); if (n <= 0) { clearInterval(t); snap(); } }, 1000);
  };
  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black p-4" role="dialog" aria-modal="true" aria-label={tx("Take a selfie")}>
      <button onClick={onClose} aria-label={tx("Close")} className="absolute end-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      {err ? <p className="max-w-sm text-center text-white">{err}</p> : (
        <>
          <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-3xl bg-black">
            <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            {/* Face guide */}
            <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              <defs><mask id="hole"><rect width="300" height="400" fill="white" /><ellipse cx="150" cy="185" rx="95" ry="128" fill="black" /></mask></defs>
              <rect width="300" height="400" fill="rgba(0,0,0,.45)" mask="url(#hole)" />
              <ellipse cx="150" cy="185" rx="95" ry="128" fill="none" stroke="white" strokeWidth="2.5" strokeDasharray="6 6" />
            </svg>
            {count > 0 && <span className="absolute inset-0 grid place-items-center text-7xl font-bold text-white drop-shadow">{count}</span>}
          </div>
          <p className="mt-4 max-w-sm text-center text-sm text-white/85">{tx("Fit your face in the oval. Face a window, no make-up, hair back, no filters.")}</p>
          <button onClick={start} disabled={count > 0} aria-label={tx("Take the photo")} className="mt-5 grid h-20 w-20 place-items-center rounded-full border-4 border-white disabled:opacity-50">
            <span className="h-14 w-14 rounded-full bg-white" />
          </button>
        </>
      )}
    </div>
  );
}

export function SkinScan({ intro, ready }: { intro: string; ready: boolean }) {
  const tx = useT();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<{ analysis: Analysis; steps: Step[] } | null>(null);
  const [consent, setConsent] = useState(false);
  const { addMany, setDrawerOpen } = useShop();
  const [camera, setCamera] = useState(false);
  const [warn, setWarn] = useState("");
  const live = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  async function pick(f?: File) {
    if (!f) return;
    const data = await shrink(f).catch(() => "");
    if (!data) return setErr(tx("We couldn't open that photo. Try a JPG or PNG."));
    await analyse(data);
  }

  async function analyse(data: string, force = false) {
    setErr("");
    setRes(null);
    setPreview(data);
    // Light check first: a dark or washed-out photo gives a poor reading.
    const b = await brightness(data);
    if (!force && (b < 60 || b > 225)) {
      setWarn(b < 60 ? tx("This photo looks too dark for a good reading. Face a window or turn on a light, then try again.") : tx("This photo looks too bright. Move out of direct sun or away from the flash, then try again."));
      return;
    }
    setWarn("");
    setBusy(true);
    const r = await fetch("/api/skin-scan/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: data }), signal: AbortSignal.timeout(70_000) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (input.current) input.current.value = ""; // so the same photo can be picked again
    if (!r) return setErr(tx("No connection, or the scan took too long. Please try again."));
    if (!r.ok) return setErr(d.error === "not_configured" ? tx("The AI skin scan isn't switched on yet. Use the quiz instead — it takes a minute.") : tx(d.error ?? "Please try again"));
    setRes(d);
  }

  const firstPicks = res?.steps.map((s) => s.picks[0]).filter(Boolean) ?? [];
  return (
    <div className="container-x max-w-5xl py-10">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-sale">{tx("New")}</p>
      <h1 className="mt-1 text-4xl font-black">{tx("AI skin scan")}</h1>
      <p className="mt-3 max-w-2xl text-muted">{intro}</p>
      {!ready && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">{tx("The AI scan isn't connected yet.")} <Link href="/routine/" className="font-semibold underline">Take the 1-minute routine quiz</Link> instead.</p>}

      <div className="mt-8 grid gap-8 md:grid-cols-[320px_1fr]">
        <div>
          <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded-2xl bg-[#f5f5f5]">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Your photo" className="h-full w-full object-cover" />
            ) : (
              <p className="p-6 text-center text-sm text-muted">{tx("Face the light, no make-up, hair away from your face.")}</p>
            )}
          </div>
          <label className="mt-3 flex items-start gap-2 text-xs text-muted"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" /> {tx("I agree that my photo is sent once to an AI service to read my skin. It isn't stored.")}</label>
          <input ref={input} type="file" accept="image/*" capture={live ? undefined : "user"} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <input id="skin-upload" type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <button disabled={!consent || busy || !ready} onClick={() => (live ? setCamera(true) : input.current?.click())} className="tap mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-ink font-semibold text-white disabled:opacity-40">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            {busy ? tx("Reading your skin…") : preview ? tx("Take another selfie") : tx("Take a selfie")}
          </button>
          <label htmlFor="skin-upload" aria-disabled={!consent || busy || !ready} className={`tap mt-2 flex w-full cursor-pointer items-center justify-center rounded-full border border-line font-semibold ${!consent || busy || !ready ? "pointer-events-none opacity-40" : ""}`}>{tx("Upload a photo")}</label>
          {!consent && <p className="mt-2 text-center text-xs text-muted">{tx("Tick the box above to start.")}</p>}
          {warn && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
              <p>{warn}</p>
              <div className="mt-2 flex gap-3"><button onClick={() => (setWarn(""), live ? setCamera(true) : input.current?.click())} className="font-semibold underline">{tx("Retake")}</button><button onClick={() => analyse(preview, true)} className="text-muted underline">{tx("Use it anyway")}</button></div>
            </div>
          )}
          {camera && <SelfieCamera onClose={() => setCamera(false)} onShot={(d) => { setCamera(false); analyse(d); }} />}
          {err && <p className="mt-3 text-sm text-sale">{err}</p>}
          <details className="mt-4 rounded-xl border border-line p-3 text-[12px] text-muted">
            <summary className="cursor-pointer font-semibold text-ink">{tx("Important: what this scan is and isn't")}</summary>
            <ul className="mt-2 list-disc space-y-1 ps-4">
              <li>{tx("This is an AI cosmetic skin assessment to help you choose skincare. It is not a medical examination or diagnosis and does not replace a doctor, dermatologist or pharmacist.")}</li>
              <li>{tx("Results depend on your photo: light, camera, make-up and filters can change the reading.")}</li>
              <li>{tx("It cannot detect skin diseases, check moles or spots for cancer, or judge allergies. See a doctor for any spot that changes, bleeds or itches, or for painful, spreading or persistent skin problems.")}</li>
              <li>{tx("Patch-test new products and stop if irritation occurs. If you're pregnant, breastfeeding or on prescription skin treatment, ask our pharmacist before starting new actives.")}</li>
              <li>{tx("Your photo is sent once to an AI service (Anthropic) to read your skin. It is not stored by SuperYou or used to identify you.")}</li>
            </ul>
          </details>
        </div>
        <div>
          {res ? (
            <>
              <div className="rounded-2xl border border-line p-5">
                <p className="text-sm text-muted">Your skin today</p>
                <p className="mt-1 text-2xl font-bold">{res.analysis.skinType} skin{res.analysis.sensitive ? ", easily irritated" : ""}</p>
                {res.analysis.concerns.length > 0 && <p className="mt-1 text-sm">Focus: {res.analysis.concerns.join(" · ")}</p>}
                <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-muted">{res.analysis.observations.map((o) => <li key={o}>{o}</li>)}</ul>
                {!!res.analysis.zones?.length && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {res.analysis.zones.map((z) => <p key={z.zone} className="rounded-xl bg-[#f6f1f3] px-3 py-2 text-sm"><b className="capitalize">{z.zone}</b>: {z.note}</p>)}
                  </div>
                )}
                {res.analysis.confidence && (
                  <p className="mt-3 text-xs text-muted">
                    {tx("Reading confidence")}: <b className={res.analysis.confidence === "high" ? "text-green-700" : res.analysis.confidence === "low" ? "text-sale" : ""}>{tx(res.analysis.confidence)}</b>
                    {res.analysis.photoTips ? ` · ${res.analysis.photoTips}` : ""}
                  </p>
                )}
                {res.analysis.advice && <p className="mt-2 text-xs text-muted">{res.analysis.advice}</p>}
              </div>
              {!!res.analysis.redFlags?.length && (
                <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
                  <p className="font-semibold text-sale">{tx("Please see a doctor or pharmacist first")}</p>
                  <ul className="mt-1 list-disc ps-5">{res.analysis.redFlags.map((f) => <li key={f}>{f}</li>)}</ul>
                  <Link href="/services/?book=video-consult" className="mt-2 inline-block font-semibold underline">{tx("Book a free video call with our pharmacist")}</Link>
                </div>
              )}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Your routine</h2>
                {firstPicks.length > 0 && <button onClick={() => (addMany(firstPicks), setDrawerOpen(true))} className="tap rounded-full bg-ink px-5 text-sm font-semibold text-white">Add the whole routine ({firstPicks.length})</button>}
              </div>
              <div className="mt-4 space-y-6">
                {res.steps.map((s, i) => (
                  <div key={s.id}>
                    <p className="font-semibold">{i + 1}. {s.name} <span className="text-xs font-normal uppercase text-muted">{s.time === "both" ? "AM + PM" : s.time.toUpperCase()}</span></p>
                    <p className="text-sm text-muted">{s.tip}</p>
                    <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">{s.picks.slice(0, 3).map((p) => <ProductCard key={p.id} product={p} />)}</div>
                  </div>
                ))}
              </div>
              <PharmacistButton product="my skin scan results" className="mt-6" />
            </>
          ) : (
            <>
            <ol className="space-y-4 text-sm">
              {["Take a selfie in daylight, facing the window.", tx("The AI reads visible skin type, shine, redness, dryness and spots."), "We build a morning and evening routine from products in stock — add it to your bag in one tap."].map((x, i) => (
                <li key={x} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">{i + 1}</span><span className="pt-1">{x}</span></li>
              ))}
            </ol>
            <div className="mt-6 rounded-2xl bg-[#f6f1f3] p-5">
              <p className="font-semibold">{tx("For the most accurate reading")}</p>
              <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
                {["Clean, bare skin: no make-up, no tinted sunscreen", "Daylight from a window in front of you, not behind", "No flash, no beauty filters or portrait mode", "Hair back, glasses off, face straight to the camera", "Hold the phone at eye level, about an arm's length away", "Wait 30 minutes after washing so redness settles"].map((x) => (
                  <li key={x} className="flex gap-2"><span aria-hidden className="text-brand-700">✓</span><span>{tx(x)}</span></li>
                ))}
              </ul>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
