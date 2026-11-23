"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/site-context";

// Face ID-style guided scan: live 3D face tracking in the browser (on the phone, nothing uploaded while
// tracking), a ring that fills as the head turns in a circle, and three photos taken automatically:
// front, one side, the other side. Falls back to a single live camera shot if tracking can't start.
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const TICKS = 72; // like the Face ID setup ring

type P = { x: number; y: number; z: number };
type Dir = "right" | "left" | "up" | "down";

export function FaceScan3D({ onDone, onFallback, onClose }: { onDone: (shots: string[], meshImage?: string) => void; onFallback: () => void; onClose: () => void }) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<"loading" | "front" | "circle" | "done" | "error">("loading");
  const [msg, setMsg] = useState("");
  const [pct, setPct] = useState(0);
  const [guide, setGuide] = useState<Dir | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null, raf = 0, stopped = false;
    let landmarker: { detectForVideo: (v: HTMLVideoElement, ts: number) => { faceLandmarks: P[][] }; close: () => void } | null = null;
    const lit = new Array<number>(TICKS).fill(0);
    const shots: { front?: string; a?: string; b?: string; up?: string; down?: string } = {};
    const prog = new Array<number>(TICKS).fill(0); // each tick grows smoothly (0 → 1) once reached
    let sdx = 0, sdy = 0; // smoothed head direction, so the ring and guide don't jitter
    let hintAt = 0, arrowAng = 0, gapAng = 0;
    let base: { x: number; y: number } | null = null, calib: { x: number; y: number }[] = [];
    let startedCircle = 0, doneAt = 0, lastLit = 0, lastGuide: Dir | null = null;
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
      const cx = W / 2;
      if (lm) {
        // to canvas coords (mirrored)
        const pts = lm.map((p) => ({ x: W - ((p.x * vw - sx) / cw) * W, y: p.y * H }));
        const done = doneAt ? Math.min(1, (now - doneAt) / 900) : 0;
        const glow = 0.55 + 0.2 * Math.sin(now / 300);
        g.strokeStyle = `rgba(255,170,205,${(glow - done * 0.45).toFixed(2)})`; g.lineWidth = 1.1;
        g.beginPath();
        for (const c of tess) { const a = pts[c.start], b = pts[c.end]; if (a && b) { g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); } }
        g.stroke();
        g.fillStyle = "rgba(255,255,255,.95)";
        for (let i = 0; i < pts.length; i += 2) { g.fillRect(pts[i].x - 1.5, pts[i].y - 1.5, 3, 3); }
        // scanning line sweeping down the face
        const ys = pts.map((p) => p.y), top = Math.min(...ys), bot = Math.max(...ys), sy = top + ((now / 1400) % 1) * (bot - top);
        const grad = g.createLinearGradient(0, sy - 18, 0, sy + 2);
        grad.addColorStop(0, "rgba(255,120,180,0)"); grad.addColorStop(1, "rgba(255,160,210,.8)");
        g.fillStyle = grad; g.fillRect(Math.min(...pts.map((p) => p.x)), sy - 18, Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)), 20);
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
              lastGuide = null;
            } else setMsg(t("Hold still…"));
          }
        } else if (!doneAt) {
          // Smooth the head direction (removes jitter), mirrored to match the screen.
          sdx += (-(dir.x - base.x) - sdx) * 0.25;
          sdy += ((dir.y - base.y) - sdy) * 0.25;
          const dx = sdx, dy = sdy;
          const mag = Math.hypot(dx * 1.6, dy * 2.2);
          if (mag > 0.075) {
            const ang = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
            const i = Math.round((ang / (Math.PI * 2)) * TICKS) % TICKS;
            for (let k = -1; k <= 1; k++) lit[(i + k + TICKS) % TICKS] = 1;
          }
          // Five photos: front (taken), both sides, chin up and chin down.
          if (dx > 0.14 && !shots.a) shots.a = capture(v);
          if (dx < -0.14 && !shots.b) shots.b = capture(v);
          if (dy < -0.07 && Math.abs(dx) < 0.08 && !shots.up) shots.up = capture(v);
          if (dy > 0.08 && Math.abs(dx) < 0.08 && !shots.down) shots.down = capture(v);
          const n = lit.reduce((s, x) => s + x, 0);
          if (n !== lastLit) { lastLit = n; setPct(Math.round((n / TICKS) * 100)); }
          // Where is the biggest part of the ring still empty? The guide arrow glides there.
          let best = -1, bestLen = 0;
          for (let i = 0; i < TICKS; i++) {
            if (lit[i]) continue;
            let len = 0;
            while (len < TICKS && !lit[(i + len) % TICKS]) len++;
            if (len > bestLen) { bestLen = len; best = i + len / 2; }
          }
          if (best >= 0) gapAng = (best / TICKS) * Math.PI * 2;
          // Calm instructions: change at most every 1.5 s.
          if (now - hintAt > 1500) {
            let next: Dir;
            if (!shots.a && !shots.b) next = "right";
            else if (!shots.a) next = "right";
            else if (!shots.b) next = "left";
            else {
              const deg = (gapAng * 180) / Math.PI;
              next = deg < 45 || deg >= 315 ? "right" : deg < 135 ? "down" : deg < 225 ? "left" : "up";
            }
            if (next !== lastGuide) {
              lastGuide = next; hintAt = now;
              setGuide(next);
              setMsg(n < 6 ? t("Move your head slowly to complete the circle") : next === "right" ? t("Keep going slowly this way →") : next === "left" ? t("Now slowly the other way ←") : next === "up" ? t("Slowly lift your chin ↑") : t("Slowly lower your chin ↓"));
            }
          }
          const enough = n / TICKS >= 0.92 && shots.a && shots.b && shots.up && shots.down;
          if (enough || now - startedCircle > 45000) { doneAt = now; lit.fill(1); setPct(100); setStage("done"); setGuide(null); setMsg(t("Scan complete")); }
        }
      } else if (!doneAt) setMsg(t("Fit your face in the circle"));
      // Face ID-style ring: a true circle of thin ticks that grow and turn green smoothly.
      const R = W * 0.4, rcy = H * 0.45;
      for (let i = 0; i < TICKS; i++) {
        prog[i] += ((lit[i] ? 1 : 0) - prog[i]) * 0.12;
        const a = (i / TICKS) * Math.PI * 2, p = prog[i];
        const x1 = cx + Math.cos(a) * (R + 8), y1 = rcy + Math.sin(a) * (R + 8);
        const len = 10 + p * 16;
        const gr = Math.round(255 - p * (255 - 74)), gg = Math.round(255 - p * (255 - 222)), gb = Math.round(255 - p * (255 - 128));
        g.strokeStyle = `rgba(${gr},${gg},${gb},${(0.35 + p * 0.65).toFixed(2)})`;
        g.lineWidth = 3; g.lineCap = "round";
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 + Math.cos(a) * len, y1 + Math.sin(a) * len); g.stroke();
      }
      // Guide arrow glides around the ring to the part still to fill.
      if (startedCircle && !doneAt && lastLit >= 3) {
        let d = gapAng - arrowAng;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        arrowAng += d * 0.06;
        const ax = cx + Math.cos(arrowAng) * (R + 44), ay = rcy + Math.sin(arrowAng) * (R + 44);
        const pulse = 0.7 + 0.3 * Math.sin(now / 250);
        g.save(); g.translate(ax, ay); g.rotate(arrowAng);
        g.fillStyle = `rgba(255,255,255,${pulse.toFixed(2)})`;
        g.beginPath(); g.moveTo(14, 0); g.lineTo(-8, -11); g.lineTo(-3, 0); g.lineTo(-8, 11); g.closePath(); g.fill();
        g.restore();
      }
      if (doneAt && now - doneAt > 1100) {
        stopped = true;
        cancelAnimationFrame(raf);
        // Keep the finished 3D scan (face mesh + full green ring) as the result picture.
        const mesh = canvas.current?.toDataURL("image/jpeg", 0.85);
        onDone([shots.front, shots.a, shots.b, shots.up, shots.down].filter((s): s is string => !!s), mesh);
      }
    }
    return () => { stopped = true; clearTimeout(timeout); cancelAnimationFrame(raf); stream?.getTracks().forEach((x) => x.stop()); landmarker?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black p-4" role="dialog" aria-modal="true" aria-label={t("SuperScan")}>
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
            {stage === "loading" && <p className="absolute inset-0 grid place-items-center text-sm text-white/80">{t("Starting SuperScan…")}</p>}
            {(stage === "front" || stage === "circle") && <SwivelGuide dir={stage === "circle" ? guide : null} />}
            {stage === "done" && <span className="absolute inset-0 grid place-items-center"><span className="grid h-20 w-20 place-items-center rounded-full bg-green-500 text-4xl text-white">✓</span></span>}
          </div>
          <p className="mt-4 min-h-[1.5em] text-center text-lg font-semibold text-white" aria-live="polite">{msg}</p>
          {stage === "circle" && <p className="text-sm text-white/70">{pct}%</p>}
          <p className="mt-2 max-w-sm text-center text-xs text-white/60">{t("Face a window, no make-up, hair back. Move slowly, like setting up Face ID. Tracking runs on your phone; only the 5 finished photos are sent to read your skin, then deleted.")}</p>
          <button onClick={onFallback} className="mt-3 text-xs text-white/60 underline">{t("Use a single camera shot instead")}</button>
        </>
      )}
    </div>
  );
}

/** Animated "how to turn your head" guide: a small head that shows the movement, and a pulsing arrow on the side to turn to. */
function SwivelGuide({ dir }: { dir: Dir | null }) {
  const anim = dir ? `sy-look-${dir}` : "sy-swivel";
  const arrow: Record<Dir, string> = { right: "right-2 top-1/2 -translate-y-1/2", left: "left-2 top-1/2 -translate-y-1/2", up: "top-2 left-1/2 -translate-x-1/2", down: "bottom-16 left-1/2 -translate-x-1/2" };
  const rot: Record<Dir, number> = { right: 0, down: 90, left: 180, up: 270 };
  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-2xl bg-black/55 p-2 backdrop-blur" aria-hidden>
        <svg width="56" height="56" viewBox="0 0 56 56">
          <ellipse cx="28" cy="29" rx="17" ry="21" fill="none" stroke="white" strokeWidth="2" />
          <g style={{ animation: `${anim} ${dir ? "1.4s" : "2.6s"} ease-in-out infinite` }}>
            <circle cx="22" cy="25" r="2" fill="white" />
            <circle cx="34" cy="25" r="2" fill="white" />
            <path d="M28 27 L26 33 L29 33" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M23 39 Q28 42 33 39" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          </g>
          {!dir && <circle r="2.5" fill="#ff8fb6"><animateMotion dur="2.6s" repeatCount="indefinite" path="M28 4 A24 24 0 1 1 27.9 4" /></circle>}
        </svg>
      </div>
      {false && dir && (
        <span className={`pointer-events-none absolute ${arrow[dir!]} grid h-14 w-14 place-items-center rounded-full bg-white/90 text-ink shadow-lg`} style={{ animation: "sy-nudge 1s ease-in-out infinite" }} aria-hidden>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${rot[dir!]}deg)` }}><path d="M5 12h13M13 6l6 6-6 6" /></svg>
        </span>
      )}
    </>
  );
}
