"use client";

import { AfterRoutine } from "../clinic/AfterRoutine";
import type { ClinicItem } from "../clinic/ClinicView";
import { useGrowth, useT } from "@/lib/site-context";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PharmacistButton } from "@/components/Growth";
import { ProductCard } from "@/components/ProductCard";
import type { CardItem } from "@/lib/listing";
import { useShop } from "@/lib/store";
import { FaceScan3D } from "./FaceScan3D";
import { PreviousScan, SendRoutine, ShareScan } from "./ScanExtras";

type Step = { id: string; name: string; time: string; tip: string; picks: CardItem[]; why?: string; skipped?: boolean };
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

/** Fallback when 3D tracking can't run: live front camera, oval guide and a 3-second countdown (no uploads). */
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
      .catch(() => setErr(tx("We couldn't open your camera. Allow camera access in your browser settings, then try again.")));
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
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black p-4" role="dialog" aria-modal="true" aria-label={tx("Face scan")}>
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
  const videoOn = useGrowth().videoCalls !== false;
  const tx = useT();
  const [preview, setPreview] = useState("");
  const [mesh, setMesh] = useState("");
  const [ask, setAsk] = useState(false);
  const [info, setInfo] = useState(false);
  // Phones: the description opens as a pop-up every time SuperScan is opened (from the tab bar or a link).
  useEffect(() => {
    try { if (window.matchMedia("(max-width: 767px)").matches) setInfo(true); } catch { /* old browser */ }
  }, []);
  const [slow, setSlow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<{ ai?: boolean; summary?: string; notes?: string[]; actives?: string[]; analysis: Analysis; steps: Step[]; treatments?: ClinicItem[]; clinic?: { partner: string; mock: boolean } } | null>(null);
  const [consent, setConsent] = useState(false);
  const { addMany, setDrawerOpen } = useShop();
  const [camera, setCamera] = useState(false);
  const [scan3d, setScan3d] = useState(false);
  const [sides, setSides] = useState<string[]>([]);
  const [warn, setWarn] = useState("");
  const live = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  // Coming back from the 6-week reminder: show the previous reading to compare.
  const [prev, setPrev] = useState<{ createdAt: string; analysis: Analysis } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("from"), t = q.get("t");
    if (id && t) fetch(`/api/skin-scan/save/?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setPrev(d)).catch(() => {});
  }, []);

  // Inside the SuperYou iPhone app: the Face ID (TrueDepth) camera does the scan natively.
  const meta = useRef<Record<string, unknown> | null>(null);
  async function start() {
    type FS = { isAvailable: () => Promise<{ available: boolean }>; scan: () => Promise<{ front: string; sides: string[]; distanceCm: number; light: number; colorTemp: number }> };
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { FaceScan?: FS } } }).Capacitor;
    const fs = cap?.isNativePlatform?.() ? cap.Plugins?.FaceScan : undefined;
    if (fs && (await fs.isAvailable().catch(() => ({ available: false }))).available) {
      const r = await fs.scan().catch(() => null);
      if (r?.front) { meta.current = { depth: true, distanceCm: r.distanceCm, light: r.light, colorTemp: r.colorTemp }; analyse(r.front, false, r.sides ?? []); }
      return;
    }
    meta.current = null;
    setScan3d(true);
  }

  async function analyse(data: string, force = false, extra: string[] = sides) {
    setErr("");
    setSides(extra);
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
    setSlow(false);
    const slowT = setTimeout(() => setSlow(true), 12_000); // by then the photos are read and the catalog is being matched
    const r = await fetch("/api/skin-scan/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: data, sides: extra, meta: meta.current ?? undefined }), signal: AbortSignal.timeout(120_000) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    clearTimeout(slowT);
    setBusy(false);
    if (!r) return setErr(tx("No connection, or the scan took too long. Please try again."));
    if (!r.ok) return setErr(d.error === "not_configured" ? tx("SuperScan isn't switched on yet. Use the quiz instead — it takes a minute.") : tx(d.error ?? "Please try again"));
    setRes(d);
  }

  const firstPicks = res?.steps.filter((s) => !s.skipped).map((s) => s.picks[0]).filter(Boolean) ?? [];
  return (
    <div className="container-x max-w-5xl py-4 md:py-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-sale">{tx("New")} · {tx("3D AI skin scan")}</p>
          <h1 className="mt-0.5 text-3xl font-black md:text-4xl">SuperScan</h1>
        </div>
        <button onClick={() => setInfo(true)} className="tap shrink-0 rounded-full border border-line px-4 text-sm font-semibold md:hidden">{tx("How it works")}</button>
      </div>
      {/* Desktop has room for the description; phones get it as a pop-up they dismiss once. */}
      <p className="mt-3 hidden max-w-2xl text-muted md:block">{intro}</p>
      {info && <IntroSheet text={intro} onClose={() => setInfo(false)} />}
      {!ready && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">{tx("The AI scan isn't connected yet.")} <Link href="/routine/" className="font-semibold underline">Take the 1-minute routine quiz</Link> instead.</p>}

      <div className="mt-4 grid gap-8 md:mt-8 md:grid-cols-[320px_1fr]">
        <div>
          {/* Sized to the screen: on a phone the preview, the button and the agreement note all fit without scrolling. */}
          <div className="mx-auto grid aspect-square place-items-center overflow-hidden rounded-[28px] bg-[#111] md:w-full" style={{ width: "min(100%, 46dvh)" }}>
            {mesh ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mesh} alt={tx("Your 3D SuperScan")} className="h-full w-full object-cover" />
            ) : preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Your photo" className="h-full w-full object-cover" />
            ) : (
              <ScanPlaceholder caption={tx("Your SuperScan will appear here")} />
            )}
          </div>
          {sides.length > 0 && (
            <div className="mt-2 flex gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {sides.map((s, i) => <img key={i} src={s} alt={tx("Side view")} className="h-20 w-16 rounded-lg object-cover" />)}
              <p className="self-center text-xs text-muted">{tx("3D scan: front and both sides")}</p>
            </div>
          )}
          <button disabled={busy || !ready || !live} onClick={() => setAsk(true)} className="scan-glow tap mt-4 flex w-full items-center justify-center gap-2 rounded-full font-semibold text-white disabled:opacity-40">
            <FaceIdGlyph size={20} />
            {busy ? (slow ? tx("Matching with our full catalog…") : tx("Reading your skin…")) : preview ? tx("Scan again") : tx("Start SuperScan")}
          </button>
          {ask && <ConsentSheet onClose={() => setAsk(false)} onAgree={() => { setAsk(false); setConsent(true); start(); }} />}
          {!live && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs">{tx("SuperScan needs a camera. Open this page on your phone, or allow camera access in your browser.")}</p>}
          {live && !consent && <p className="mt-2 text-center text-xs text-muted">{tx("We ask for your OK before the camera opens.")}</p>}
          {warn && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
              <p>{warn}</p>
              <div className="mt-2 flex gap-3"><button onClick={() => (setWarn(""), start())} className="font-semibold underline">{tx("Retake")}</button><button onClick={() => analyse(preview, true, sides)} className="text-muted underline">{tx("Use it anyway")}</button></div>
            </div>
          )}
          {camera && <SelfieCamera onClose={() => setCamera(false)} onShot={(d) => { setCamera(false); setMesh(""); analyse(d, false, []); }} />}
          {scan3d && <FaceScan3D onClose={() => setScan3d(false)} onFallback={() => { setScan3d(false); setCamera(true); }} onDone={([front, ...rest], m) => { setScan3d(false); setMesh(m ?? ""); if (front) analyse(front, false, rest); }} />}
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
          {prev && <PreviousScan prev={prev} />}
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
              {(res.summary || !!res.actives?.length) && (
                <div className="mt-4 rounded-2xl bg-[#f6f1f3] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">{tx("Matched by AI from our full catalog")}</p>
                  {res.summary && <p className="mt-2 text-sm">{res.summary}</p>}
                  {!!res.actives?.length && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted">{tx("Ingredients to look for")}:</span>
                      {res.actives.map((x) => <span key={x} className="rounded-full bg-white px-3 py-1 font-semibold">{x}</span>)}
                    </div>
                  )}
                  {!!res.notes?.length && <ul className="mt-3 list-disc space-y-1 ps-5 text-xs text-muted">{res.notes.map((x) => <li key={x}>{x}</li>)}</ul>}
                </div>
              )}
              {!!res.analysis.redFlags?.length && (
                <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
                  <p className="font-semibold text-sale">{tx("Please see a doctor or pharmacist first")}</p>
                  <ul className="mt-1 list-disc ps-5">{res.analysis.redFlags.map((f) => <li key={f}>{f}</li>)}</ul>
                  {videoOn && <Link href="/services/?book=video-consult" className="mt-2 inline-block font-semibold underline">{tx("Book a free video call with our pharmacist")}</Link>}
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
                    {s.why && <p className="text-sm font-medium text-brand-700">{s.why}</p>}
                    {s.skipped && <p className="text-xs text-muted">{tx("Optional for your skin right now")}</p>}
                    <p className="text-sm text-muted">{s.tip}</p>
                    <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">{s.picks.slice(0, 3).map((p) => <ProductCard key={p.id} product={p} />)}</div>
                  </div>
                ))}
              </div>
              <AfterRoutine items={res.treatments ?? []} partner={res.clinic?.partner} mock={res.clinic?.mock} />
              <SendRoutine analysis={res.analysis} steps={res.steps} />
              <ShareScan analysis={res.analysis} steps={res.steps} />
              <PharmacistButton product="my SuperScan results" className="mt-6" />
            </>
          ) : (
            <>
            <ol className="space-y-4 text-sm">
              {[tx("Start SuperScan facing a window, then slowly turn your head in a circle."), tx("The AI reads visible skin type, shine, redness, dryness and spots."), tx("We build a morning and evening routine from products in stock — add it to your bag in one tap.")].map((x, i) => (
                <li key={x} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">{i + 1}</span><span className="pt-1">{x}</span></li>
              ))}
            </ol>
            <div className="mt-6 rounded-2xl bg-[#f6f1f3] p-5">
              <p className="font-semibold">{tx("For the most accurate reading")}</p>
              <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
                {["Clean, bare skin: no make-up, no tinted sunscreen", "Daylight from a window in front of you, not behind", "No flash, no beauty filters or portrait mode", "Hair back, glasses off, turn your head slowly", "Hold the phone at eye level, about an arm's length away", "Wait 30 minutes after washing so redness settles"].map((x) => (
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

// A face-shaped mesh for the preview: points on an oval face (wider at the cheeks, narrower at the chin),
// joined to their near neighbours, plus eyes, nose and mouth points.
const MESH = (() => {
  const pts: [number, number][] = [];
  for (let r = -6; r <= 6; r++) {
    const y = r / 6, w = Math.sqrt(Math.max(0, 1 - y * y)) * (y > 0.2 ? 1 - (y - 0.2) * 0.45 : 1);
    const n = Math.max(2, Math.round(9 * w));
    for (let c = 0; c <= n; c++) pts.push([(c / n - 0.5) * 2 * w * 44, y * 56]);
  }
  for (const f of [[-17, -12], [-12, -12], [-22, -12], [17, -12], [12, -12], [22, -12], [0, 2], [-5, 8], [5, 8], [-12, 24], [0, 27], [12, 24]] as [number, number][]) pts.push(f);
  const lines: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1]; if (dx * dx + dy * dy < 12.5 * 12.5) lines.push([i, j]); }
  return { pts, lines };
})();

/** Before the scan: the Face ID setup animation. A head in a circle looks round while a curved arrow
 *  sweeps the ring clockwise and the ticks behind it turn green; when the circle is full, a green tick,
 *  then it starts again. */
function ScanPlaceholder({ caption }: { caption: string }) {
  const T = 120, P = 4200, HOLD = 1300;
  const [t, setT] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setT(P * 0.6); return; }
    let raf = 0, last = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return; // ~30 fps is plenty
      last = now;
      setT((now - t0) % (P + HOLD));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const p = Math.min(1, t / P), done = t >= P;
  const ang = -Math.PI / 2 + p * Math.PI * 2; // starts at the top, goes clockwise
  const cx = 150, cy = 150, R = 92, RR = R + 14;
  const look = done ? { x: 0, y: 0 } : { x: Math.cos(ang) * 9, y: Math.sin(ang) * 9 };
  // curved arrow riding just outside the ring, ending at the sweep point
  const AR = RR + 30, a0 = ang - 0.55;
  const arc = `M ${cx + Math.cos(a0) * AR} ${cy + Math.sin(a0) * AR} A ${AR} ${AR} 0 0 1 ${cx + Math.cos(ang) * AR} ${cy + Math.sin(ang) * AR}`;
  const tip = { x: cx + Math.cos(ang + 0.12) * AR, y: cy + Math.sin(ang + 0.12) * AR };
  const back = (k: number) => ({ x: cx + Math.cos(ang - 0.02) * (AR + k), y: cy + Math.sin(ang - 0.02) * (AR + k) });
  return (
    <div className="relative grid h-full w-full place-items-center">
      <svg viewBox="0 0 300 300" className="h-full w-full" aria-hidden>
        {Array.from({ length: T }, (_, i) => {
          const a = -Math.PI / 2 + (i / T) * Math.PI * 2;
          const lit = done || i / T <= p;
          const len = lit ? 16 : 10;
          return <line key={i} x1={cx + Math.cos(a) * RR} y1={cy + Math.sin(a) * RR} x2={cx + Math.cos(a) * (RR + len)} y2={cy + Math.sin(a) * (RR + len)} stroke={lit ? "#34c759" : "rgba(255,255,255,.28)"} strokeWidth="2" strokeLinecap="round" />;
        })}
        <defs>
          <clipPath id="sy-circle"><circle cx={cx} cy={cy} r={R} /></clipPath>
          <linearGradient id="sy-glass" x1="0" x2="1"><stop offset="0" stopColor="#aad7ff" stopOpacity=".15" /><stop offset=".5" stopColor="#e6f3ff" stopOpacity=".6" /><stop offset="1" stopColor="#96c8ff" stopOpacity=".2" /></linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={R} fill="#1c1a1d" />
        {!done && (
          <g transform={`translate(${look.x} ${look.y})`}>
            {/* 3D face mesh: lines and points over the face, plus a scan line sweeping down it */}
            <g stroke="#ffaacd" strokeOpacity=".5" strokeWidth=".8">{MESH.lines.map(([a, b], k) => <line key={k} x1={cx + MESH.pts[a][0]} y1={cy + MESH.pts[a][1]} x2={cx + MESH.pts[b][0]} y2={cy + MESH.pts[b][1]} />)}</g>
            <g fill="#fff">{MESH.pts.map(([x, y], k) => <rect key={k} x={cx + x - 1.2} y={cy + y - 1.2} width="2.4" height="2.4" />)}</g>
            <rect x={cx - 46} y={cy - 58 + ((t / 1400) % 1) * 116} width="92" height="4" rx="2" fill="#ff9fcb" opacity=".55" />
          </g>
        )}
        {!done && (
          // the orbiting glass light sweep
          <g clipPath="url(#sy-circle)" fill="none">
            <ellipse cx={cx} cy={cy} rx={Math.max(2, Math.abs(Math.cos(t / 1100)) * R * 0.9)} ry={R * 1.05} stroke="url(#sy-glass)" strokeWidth="16" />
            <ellipse cx={cx} cy={cy - R * 0.42} rx={R * 1.05} ry={Math.abs(Math.sin(t / 1600)) * R * 0.35 + 3} stroke="url(#sy-glass)" strokeWidth="14" />
          </g>
        )}
        {done && <path d={`M${cx - 34} ${cy + 2} l22 22 l46 -48`} fill="none" stroke="#34c759" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />}
        {!done && p > 0.02 && (
          <g fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d={arc} />
            <path d={`M ${back(-9).x} ${back(-9).y} L ${tip.x} ${tip.y} L ${back(9).x} ${back(9).y}`} />
          </g>
        )}
      </svg>
      <p className="absolute inset-x-0 bottom-3 px-6 text-center text-[13px] font-medium text-white/75">{caption}</p>
    </div>
  );
}

/** The Face ID glyph: corner brackets, two eyes, nose and a smile. `draw` animates the strokes in. */
function FaceIdGlyph({ size = 64, draw = false, color = "currentColor" }: { size?: number; draw?: boolean; color?: string }) {
  const d = ["M4 9V6a2 2 0 0 1 2-2h3", "M15 4h3a2 2 0 0 1 2 2v3", "M20 15v3a2 2 0 0 1-2 2h-3", "M9 20H6a2 2 0 0 1-2-2v-3", "M9 9.5v1.2", "M15 9.5v1.2", "M12 9.5v4h-1", "M9 16c1.7 1.3 4.3 1.3 6 0"];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.map((p, i) => <path key={p} d={p} pathLength={1} className={draw ? "faceid-draw" : undefined} style={draw ? { animationDelay: `${i * 0.08}s` } : undefined} />)}
    </svg>
  );
}

/** Approval before the camera opens: a sheet the shopper can't miss, styled like the start of Face ID setup. */
function ConsentSheet({ onAgree, onClose }: { onAgree: () => void; onClose: () => void }) {
  const tx = useT();
  const agree = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    agree.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="scan-consent-title" onClick={onClose}>
      <div className="sheet-up w-full max-w-md rounded-t-[28px] bg-white px-6 pb-8 pt-3 text-center shadow-2xl sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto mb-6 block h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className="mx-auto grid h-24 w-24 place-items-center text-[#d13f74]"><FaceIdGlyph size={84} draw /></div>
        <h2 id="scan-consent-title" className="mt-4 text-2xl font-bold">{tx("How to SuperScan")}</h2>
        <p className="mx-auto mt-2 max-w-xs text-[15px] text-muted">{tx("Position your face in the circle, then move your head slowly to complete it, just like setting up Face ID.")}</p>
        <div className="mt-5 rounded-2xl bg-[#f6f1f3] p-4 text-start text-sm">
          <p className="font-semibold">{tx("Before we open your camera")}</p>
          <p className="mt-1 text-muted">{tx("I agree that the 5 photos from my SuperScan are sent once to an AI service (Anthropic) to read my skin. They aren't stored or used to identify me. This is cosmetic advice, not a medical diagnosis.")}</p>
        </div>
        <button ref={agree} onClick={onAgree} className="tap mt-5 w-full rounded-2xl bg-[#d13f74] text-[17px] font-semibold text-white">{tx("Agree and start scan")}</button>
        <button onClick={onClose} className="mt-2 min-h-[44px] w-full text-[15px] font-semibold text-[#d13f74]">{tx("Not now")}</button>
      </div>
    </div>
  );
}

/** Phones: the SuperScan description as a pop-up with Dismiss, shown once (and again from "How it works"). */
function IntroSheet({ text, onClose }: { text: string; onClose: () => void }) {
  const tx = useT();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/45 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="scan-intro-title" onClick={onClose}>
      <div className="sheet-up max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] bg-white px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3" onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto mb-5 block h-1.5 w-10 rounded-full bg-line" aria-hidden />
        <div className="flex items-center gap-3 text-[#d13f74]"><FaceIdGlyph size={40} draw /><h2 id="scan-intro-title" className="text-xl font-bold text-ink">{tx("How SuperScan works")}</h2></div>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{text}</p>
        <DeviceNote />
        <button onClick={onClose} autoFocus className="tap mt-5 w-full rounded-2xl bg-ink text-[17px] font-semibold text-white">{tx("Dismiss")}</button>
      </div>
    </div>
  );
}

/** Which phones get the true 3D scan, and what happens on the others. Says which one this phone is using. */
function DeviceNote() {
  const tx = useT();
  const [app, setApp] = useState(false);
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    setApp(!!cap?.isNativePlatform?.());
  }, []);
  return (
    <div className="mt-4 space-y-2 rounded-2xl bg-[#f6f1f3] p-4 text-[14px] leading-relaxed">
      <p><b>{tx("True 3D depth scan:")}</b> {tx("needs an iPhone with Face ID, in the SuperYou iPhone app. It uses the Face ID (TrueDepth) camera to read your face in depth.")}</p>
      <p><b>{tx("Other phones and the website:")}</b> {tx("Android phones, older iPhones and any browser use the front camera with 3D face tracking on the phone. Same steps, a little less depth detail.")}</p>
      <p className="text-muted">{tx("If your phone can't run the 3D scan, you can take a single photo instead.")}</p>
      {app && <p className="font-semibold text-[#2f6b4f]">✓ {tx("You're in the iPhone app: the Face ID camera will be used.")}</p>}
    </div>
  );
}
