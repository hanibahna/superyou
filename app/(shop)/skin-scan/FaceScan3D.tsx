"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/site-context";

// Face ID-style guided scan: live 3D face tracking in the browser (on the phone, nothing uploaded while
// tracking), a ring that fills as the head turns in a circle, and three photos taken automatically:
// front, one side, the other side. Falls back to a single live camera shot if tracking can't start.
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const TICKS = 60;

type P = { x: number; y: number; z: number };

export function FaceScan3D({ onDone, onFallback, onClose }: { onDone: (shots: string[]) => void; onFallback: () => void; onClose: () => void }) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<"loading" | "front" | "circle" | "done" | "error">("loading");
  const [msg, setMsg] = useState("");
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let stream: MediaStream | null = null, raf = 0, stopped = false;
    let landmarker: { detectForVideo: (v: HTMLVideoElement, ts: number) => { faceLandmarks: P[][] }; close: () => void } | null = null;
    const lit = new Array<number>(TICKS).fill(0);
    const shots: { front?: string; a?: string; b?: string } = {};
    let base: { x: number; y: number } | null = null, calib: { x: number; y: number }[] = [];
    let startedCircle = 0, doneAt = 0, lastLit = 0;
    let tess: { start: number; end: number }[] = [];

    const capture = (v: HTMLVideoElement) => {
      const h = v.videoHeight, w = Math.min(v.videoWidth, Math.round((h * 3) / 4)), k = Math.min(1, 900 / h);
      const c = document.createElement("canvas");
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext("2d")!.drawImage(v, (v.videoWidth - w) / 2, 0, w, h, 0, 0, c.width, c.height); // un-mirrored
      return c.toDataURL("image/jpeg", 0.85);
    };

    const fail = (m: string) => { if (!stopped) { setStage("error"); setMsg(m); } };
    const timeout = setTimeout(() => { if (!landmarker) fail(t("The 3D scan couldn't start on this device.")); }, 20000);

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      } catch { return fail(t("We couldn't open your camera. Allow camera access in your browser settings, then try again.")); }
      const v = video.current!;
      v.srcObject = stream; await v.play().catch(() => {});
      try {
        const mp = await import("@mediapipe/tasks-vision");
        const files = await mp.FilesetResolver.forVisionTasks(WASM);
        const make = (delegate: "GPU" | "CPU") => mp.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "VIDEO", numFaces: 1 });
        landmarker = (await make("GPU").catch(() => make("CPU"))) as unknown as typeof landmarker;
        tess = mp.FaceLandmarker.FACE_LANDMARKS_TESSELATION;
      } catch { return fail(t("The 3D scan couldn't start on this device.")); }
      if (stopped) return;
      clearTimeout(timeout);
      setStage("front");
      setMsg(t("Look straight at the screen"));
      loop();
    })();

    function loop() {
      if (stopped) return;
      raf = requestAnimationFrame(loop);
      const v = video.current, cv = canvas.current;
      if (!v || !cv || !landmarker || !v.videoWidth) return;
      const vw = v.videoWidth, vh = v.videoHeight, cw = Math.min(vw, Math.round((vh * 3) / 4)), sx = (vw - cw) / 2;
      if (cv.width !== 600) { cv.width = 600; cv.height = 800; }
      const g = cv.getContext("2d")!;
      const W = cv.width, H = cv.height, now = performance.now();
      // mirrored preview
      g.save(); g.translate(W, 0); g.scale(-1, 1); g.drawImage(v, sx, 0, cw, vh, 0, 0, W, H); g.restore();
      g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, 0, W, H);
      const res = landmarker.detectForVideo(v, now);
      const lm = res.faceLandmarks?.[0];
      const cx = W / 2, cy = H * 0.46, rx = W * 0.36, ry = H * 0.34;
      if (lm) {
        // to canvas coords (mirrored)
        const pts = lm.map((p) => ({ x: W - ((p.x * vw - sx) / cw) * W, y: p.y * H }));
        const done = doneAt ? Math.min(1, (now - doneAt) / 900) : 0;
        g.strokeStyle = `rgba(255,190,215,${0.28 - done * 0.2})`; g.lineWidth = 0.6;
        g.beginPath();
        for (const c of tess) { const a = pts[c.start], b = pts[c.end]; if (a && b) { g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); } }
        g.stroke();
        g.fillStyle = "rgba(255,255,255,.75)";
        for (let i = 0; i < pts.length; i += 3) { g.fillRect(pts[i].x - 1, pts[i].y - 1, 2, 2); }
        // head direction from the nose relative to the face outline (works without depth hardware)
        const L = lm[234], R = lm[454], N = lm[1], T = lm[10], C = lm[152];
        const dir = { x: (N.x - L.x) / (R.x - L.x) - 0.5, y: (N.y - T.y) / (C.y - T.y) };
        const faceW = Math.abs(R.x - L.x) * vw / cw;
        if (!base) {
          if (faceW < 0.3) setMsg(t("Move closer"));
          else if (faceW > 0.85) setMsg(t("Move back a little"));
          else {
            calib.push(dir);
            if (calib.length > 12) {
              base = { x: calib.reduce((s, d) => s + d.x, 0) / calib.length, y: calib.reduce((s, d) => s + d.y, 0) / calib.length };
              shots.front = capture(v);
              startedCircle = now;
              setStage("circle");
              setMsg(t("Now slowly move your head in a circle"));
            } else setMsg(t("Hold still…"));
          }
        } else if (!doneAt) {
          const dx = -(dir.x - base.x), dy = dir.y - base.y; // mirrored to match the screen
          const mag = Math.hypot(dx * 1.6, dy * 2.2);
          if (mag > 0.09) {
            const ang = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
            const i = Math.round((ang / (Math.PI * 2)) * TICKS) % TICKS;
            for (let k = -2; k <= 2; k++) lit[(i + k + TICKS) % TICKS] = 1;
          }
          if (dx > 0.13 && !shots.a) shots.a = capture(v);
          if (dx < -0.13 && !shots.b) shots.b = capture(v);
          const n = lit.reduce((s, x) => s + x, 0);
          if (n !== lastLit) { lastLit = n; setPct(Math.round((n / TICKS) * 100)); }
          const enough = n / TICKS >= 0.7 && shots.a && shots.b;
          if (enough || now - startedCircle > 25000) { doneAt = now; lit.fill(1); setPct(100); setStage("done"); setMsg(t("Scan complete")); }
        }
      } else if (!doneAt) setMsg(t("Fit your face in the circle"));
      // ring
      for (let i = 0; i < TICKS; i++) {
        const a = (i / TICKS) * Math.PI * 2, on = lit[i];
        const x1 = cx + Math.cos(a) * (rx + 10), y1 = cy + Math.sin(a) * (ry + 10);
        const len = on ? 26 : 12;
        g.strokeStyle = on ? (doneAt ? "#4ade80" : `hsl(${330 + (i / TICKS) * 60},85%,70%)`) : "rgba(255,255,255,.35)";
        g.lineWidth = 4; g.lineCap = "round";
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 + Math.cos(a) * len, y1 + Math.sin(a) * len); g.stroke();
      }
      if (doneAt && now - doneAt > 1100) {
        stopped = true;
        cancelAnimationFrame(raf);
        onDone([shots.front, shots.a, shots.b].filter((s): s is string => !!s));
      }
    }
    return () => { stopped = true; clearTimeout(timeout); cancelAnimationFrame(raf); stream?.getTracks().forEach((x) => x.stop()); landmarker?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black p-4" role="dialog" aria-modal="true" aria-label={t("3D face scan")}>
      <button onClick={onClose} aria-label={t("Close")} className="absolute end-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      <video ref={video} playsInline muted className="hidden" />
      {stage === "error" ? (
        <div className="max-w-sm text-center text-white">
          <p>{msg}</p>
          <button onClick={onFallback} className="mt-5 min-h-[48px] rounded-full bg-white px-6 font-semibold text-ink">{t("Use a single camera shot instead")}</button>
        </div>
      ) : (
        <>
          <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-3xl bg-black">
            <canvas ref={canvas} className="h-full w-full" />
            {stage === "loading" && <p className="absolute inset-0 grid place-items-center text-sm text-white/80">{t("Starting the 3D scan…")}</p>}
            {stage === "done" && <span className="absolute inset-0 grid place-items-center"><span className="grid h-20 w-20 place-items-center rounded-full bg-green-500 text-4xl text-white">✓</span></span>}
          </div>
          <p className="mt-4 min-h-[1.5em] text-center text-lg font-semibold text-white" aria-live="polite">{msg}</p>
          {stage === "circle" && <p className="text-sm text-white/70">{pct}%</p>}
          <p className="mt-2 max-w-sm text-center text-xs text-white/60">{t("Face a window, no make-up, hair back. Tracking runs on your phone; only the 3 finished photos are sent to read your skin, then deleted.")}</p>
          <button onClick={onFallback} className="mt-3 text-xs text-white/60 underline">{t("Use a single camera shot instead")}</button>
        </>
      )}
    </div>
  );
}
