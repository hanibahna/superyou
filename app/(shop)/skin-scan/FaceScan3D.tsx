"use client";

import { useEffect, useRef, useState } from "react";
import { useGrowth, useT } from "@/lib/site-context";

// Face ID setup-style scan: the camera in a circle on black, a ring of fine ticks around it that grow and
// turn green as the head moves in a circle, then the picture fades and a green tick draws itself.
// Tracking runs on the phone; only the 5 finished photos are sent (front, both sides, chin up, chin down).
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const TICKS = 150; // fine, dense ring
const GREEN: [number, number, number] = [52, 199, 89]; // iOS system green

type P = { x: number; y: number; z: number };

const mix = (p: number, from: [number, number, number], to: [number, number, number]) => from.map((f, i) => Math.round(f + (to[i] - f) * p)).join(",");
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export function FaceScan3D({ onDone, onFallback, onClose }: { onDone: (shots: string[], meshImage?: string) => void; onFallback: () => void; onClose: () => void }) {
  const t = useT();
  const meshOn = (useGrowth().skinScan as { mesh?: boolean } | undefined)?.mesh !== false;
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<"loading" | "front" | "circle" | "done" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null, raf = 0, stopped = false;
    let landmarker: { detectForVideo: (v: HTMLVideoElement, ts: number) => { faceLandmarks: P[][] }; close: () => void } | null = null;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const lit = new Array<number>(TICKS).fill(0);
    const prog = new Array<number>(TICKS).fill(0); // each tick grows smoothly 0 → 1 once reached
    const shots: { front?: string; a?: string; b?: string; up?: string; down?: string } = {};
    let sdx = 0, sdy = 0, hintAt = 0, arrowAng = 0, gapAng = 0;
    let inS = 0, inside = false, lastFrame = 0, placeAt = 0, lastPlace = "";
    let base: { x: number; y: number } | null = null, calib: { x: number; y: number }[] = [];
    let startedCircle = 0, doneAt = 0, lastLit = 0, lastHint = "", snapshot = "";
    let tess: { start: number; end: number }[] = [];
    let lastPts: { x: number; y: number }[] = [];

    // Square crop from the middle of the camera, un-mirrored (the skin reading needs the real face).
    const capture = (v: HTMLVideoElement) => {
      const h = v.videoHeight, w = Math.min(v.videoWidth, Math.round((h * 3) / 4)), k = Math.min(1, 900 / h);
      const c = document.createElement("canvas");
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext("2d")!.drawImage(v, (v.videoWidth - w) / 2, 0, w, h, 0, 0, c.width, c.height);
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
      setMsg(t("Position your face within the frame."));
      loop();
    })();

    function loop() {
      if (stopped) return;
      raf = requestAnimationFrame(loop);
      const v = video.current, cv = canvas.current;
      if (!v || !cv || !landmarker || !v.videoWidth) return;
      const vw = v.videoWidth, vh = v.videoHeight, s = Math.min(vw, vh), sx = (vw - s) / 2, sy = (vh - s) / 2;
      if (cv.width !== 800) { cv.width = 800; cv.height = 800; }
      const g = cv.getContext("2d")!;
      const W = 800, cx = 400, cy = 400, CR = 268, now = performance.now();
      const dt = lastFrame ? Math.min(100, now - lastFrame) : 16; lastFrame = now;
      const since = doneAt ? now - doneAt : 0;

      g.fillStyle = "#000"; g.fillRect(0, 0, W, W);
      // Camera inside the circle (mirrored, like a selfie). After the scan it fades out for the tick.
      const fade = doneAt ? 1 - ease((since - 450) / 500) : 1;
      if (fade > 0) {
        g.save();
        g.beginPath(); g.arc(cx, cy, CR, 0, Math.PI * 2); g.clip();
        g.globalAlpha = fade;
        g.translate(W, 0); g.scale(-1, 1);
        g.drawImage(v, sx, sy, s, s, 0, 0, W, W);
        g.restore();
        // soft inner edge, like the iPhone frame
        const edge = g.createRadialGradient(cx, cy, CR * 0.78, cx, cy, CR);
        edge.addColorStop(0, "rgba(0,0,0,0)"); edge.addColorStop(1, `rgba(0,0,0,${(0.45 * fade).toFixed(2)})`);
        g.fillStyle = edge; g.beginPath(); g.arc(cx, cy, CR, 0, Math.PI * 2); g.fill();
      }

      const res = doneAt ? null : landmarker.detectForVideo(v, now);
      const lm = res?.faceLandmarks?.[0];
      // Is the face in the circle, at the right distance?
      let place = "none";
      if (lm) {
        const X = (i: number) => W - ((lm[i].x * vw - sx) / s) * W, Y = (i: number) => ((lm[i].y * vh - sy) / s) * W;
        const fcx = (X(234) + X(454)) / 2, fcy = (Y(10) + Y(152)) / 2, fh = Y(152) - Y(10);
        const loose = !!base; // turning the head moves the face, so allow more room during the circle
        const tol = loose ? 0.4 : 0.24, minH = CR * 2 * (loose ? 0.42 : 0.52), maxH = CR * 2 * (loose ? 1.05 : 0.95);
        place = fh < minH ? "far" : fh > maxH ? "near" : Math.hypot(fcx - cx, fcy - cy) > CR * tol ? "off" : "ok";
      }
      inS += ((place === "ok" ? 1 : 0) - inS) * 0.12;
      if (inside && inS < 0.35) inside = false;
      else if (!inside && inS > 0.7) inside = true;
      if (doneAt) inside = true;
      if (!inside && !doneAt && now - placeAt > 700 && place !== lastPlace) {
        lastPlace = place; placeAt = now;
        setMsg(place === "far" ? t("Move a little closer.") : place === "near" ? t("Move a little farther away.") : place === "off" ? t("Centre your face in the circle.") : base ? t("Move back into the circle to continue.") : t("Position your face within the frame."));
      }
      if (inside && lastPlace) { lastPlace = ""; lastHint = ""; if (!base) setMsg(t("Hold still…")); }

      // The 3D face mesh: the matrix of lines and points that follows the face, plus a scan line
      // sweeping down it. Drawn inside the circle only, and gone once the scan is complete.
      // keep the last mesh for a moment after the scan completes, so the result picture shows it
      const meshPts = lm && !doneAt ? lm.map((q) => ({ x: W - ((q.x * vw - sx) / s) * W, y: ((q.y * vh - sy) / s) * W })) : doneAt && since < 450 ? lastPts : null;
      if (meshOn && meshPts?.length) {
        const pts = meshPts; if (lm) lastPts = pts;
        g.save();
        g.beginPath(); g.arc(cx, cy, CR, 0, Math.PI * 2); g.clip();
        const glow = reduce ? 0.6 : 0.5 + 0.2 * Math.sin(now / 300);
        g.strokeStyle = `rgba(255,170,205,${glow.toFixed(2)})`; g.lineWidth = 1.1;
        g.beginPath();
        for (const c of tess) { const a = pts[c.start], b = pts[c.end]; if (a && b) { g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); } }
        g.stroke();
        g.fillStyle = "rgba(255,255,255,.92)";
        for (let k = 0; k < pts.length; k += 2) g.fillRect(pts[k].x - 1.6, pts[k].y - 1.6, 3.2, 3.2);
        if (!reduce && !doneAt) {
          let top = Infinity, bot = -Infinity, left = Infinity, right = -Infinity;
          for (const q of pts) { if (q.y < top) top = q.y; if (q.y > bot) bot = q.y; if (q.x < left) left = q.x; if (q.x > right) right = q.x; }
          const yy = top + ((now / 1400) % 1) * (bot - top);
          const grad = g.createLinearGradient(0, yy - 22, 0, yy + 2);
          grad.addColorStop(0, "rgba(255,120,180,0)"); grad.addColorStop(1, "rgba(255,160,210,.75)");
          g.fillStyle = grad; g.fillRect(left, yy - 22, right - left, 24);
        }
        g.restore();
      }
      // Light sweep: a glassy band orbiting the head like a ring around a globe. It turns with time and
      // leans with the head (yaw and pitch), so the face looks scanned in 3D.
      if (!doneAt && !reduce && lm) {
        const spin = now / 1100 + sdx * 6;
        const tilt = sdy * 3;
        const band = (rx: number, ry: number, rot: number, oy: number, alpha: number) => {
          if (rx < 4) return;
          g.save();
          g.beginPath(); g.arc(cx, cy, CR, 0, Math.PI * 2); g.clip();
          g.translate(cx, cy + oy); g.rotate(rot);
          const grad = g.createLinearGradient(-rx, 0, rx, 0);
          grad.addColorStop(0, `rgba(170,215,255,${(alpha * 0.25).toFixed(2)})`);
          grad.addColorStop(0.5, `rgba(225,242,255,${alpha.toFixed(2)})`);
          grad.addColorStop(1, `rgba(150,200,255,${(alpha * 0.35).toFixed(2)})`);
          g.strokeStyle = grad; g.lineWidth = 30;
          g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.stroke();
          g.strokeStyle = `rgba(255,255,255,${(alpha * 0.9).toFixed(2)})`; g.lineWidth = 2.5;
          g.beginPath(); g.ellipse(0, 0, rx + 13, ry, 0, 0, Math.PI * 2); g.stroke();
          g.restore();
        };
        // vertical ring (meridian): its width breathes as it turns
        band(Math.abs(Math.cos(spin)) * CR * 0.9, CR * 1.05, tilt * 0.15, 0, 0.5);
        // horizontal ring (equator) high on the head, flattening and opening with the nod
        band(CR * 1.05, Math.abs(Math.sin(spin * 0.7 + tilt)) * CR * 0.35 + 6, 0, -CR * 0.42, 0.42);
      }
      if (lm && !doneAt) {
        const L = lm[234], R = lm[454], N = lm[1], T = lm[10], C = lm[152];
        const dir = { x: (N.x - L.x) / (R.x - L.x) - 0.5, y: (N.y - T.y) / (C.y - T.y) };
        if (!base) {
          if (!inside) { if (calib.length) calib = calib.slice(-4); }
          else {
            calib.push(dir);
            if (calib.length > 12) {
              base = { x: calib.reduce((a, d) => a + d.x, 0) / calib.length, y: calib.reduce((a, d) => a + d.y, 0) / calib.length };
              shots.front = capture(v);
              startedCircle = now;
              setStage("circle");
              setMsg(t("Move your head slowly to complete the circle."));
            }
          }
        } else if (!inside) {
          startedCircle += dt; // paused while the face is out of the circle
        } else {
          sdx += (-(dir.x - base.x) - sdx) * 0.25;
          sdy += ((dir.y - base.y) - sdy) * 0.25;
          const mag = Math.hypot(sdx * 1.6, sdy * 2.2);
          if (mag > 0.075) {
            const ang = (Math.atan2(sdy, sdx) + Math.PI * 2) % (Math.PI * 2);
            const i = Math.round((ang / (Math.PI * 2)) * TICKS) % TICKS;
            for (let k = -4; k <= 4; k++) lit[(i + k + TICKS) % TICKS] = 1;
          }
          if (sdx > 0.14 && !shots.a) shots.a = capture(v);
          if (sdx < -0.14 && !shots.b) shots.b = capture(v);
          if (sdy < -0.07 && Math.abs(sdx) < 0.08 && !shots.up) shots.up = capture(v);
          if (sdy > 0.08 && Math.abs(sdx) < 0.08 && !shots.down) shots.down = capture(v);
          const n = lit.reduce((a, x) => a + x, 0);
          lastLit = n;
          let best = -1, bestLen = 0;
          for (let i = 0; i < TICKS; i++) {
            if (lit[i]) continue;
            let len = 0;
            while (len < TICKS && !lit[(i + len) % TICKS]) len++;
            if (len > bestLen) { bestLen = len; best = i + len / 2; }
          }
          if (best >= 0) gapAng = (best / TICKS) * Math.PI * 2;
          if (now - hintAt > 1800 && n > TICKS * 0.6) {
            const deg = (gapAng * 180) / Math.PI;
            const h = deg < 45 || deg >= 315 ? t("Keep going slowly this way →") : deg < 135 ? t("Slowly lower your chin ↓") : deg < 225 ? t("Now slowly the other way ←") : t("Slowly lift your chin ↑");
            if (h !== lastHint) { lastHint = h; hintAt = now; setMsg(h); }
          }
          const enough = n / TICKS >= 0.94 && shots.a && shots.b && shots.up && shots.down;
          if (enough || now - startedCircle > 45000) {
            doneAt = now; lit.fill(1); setStage("done"); setMsg(t("SuperScan complete."));
            try { navigator.vibrate?.(30); } catch { /* not on iPhone */ }
          }
        }
      } else if (!doneAt && startedCircle) startedCircle += dt;

      // The ring: fine radial ticks just outside the circle. Untouched = short grey; reached = longer green.
      // Before the circle starts they breathe softly; when done they ripple once.
      const RR = CR + 22;
      for (let i = 0; i < TICKS; i++) {
        prog[i] += ((lit[i] ? 1 : 0) - prog[i]) * (reduce ? 1 : 0.14);
        const a = (i / TICKS) * Math.PI * 2; // index = head direction (0 = turned right)
        const p = prog[i];
        const ripple = doneAt && !reduce ? Math.max(0, Math.sin(Math.min(Math.PI, (since / 450 - ((i + TICKS * 0.75) % TICKS) / TICKS) * Math.PI))) * 10 : 0;
        const idle = !base && !reduce ? 3 * (0.5 + 0.5 * Math.sin(now / 420 + i / 6)) : 0;
        const len = 12 + p * 14 + ripple + idle;
        const col = mix(p, [120, 120, 128], GREEN);
        g.strokeStyle = `rgba(${col},${(0.55 + p * 0.45).toFixed(2)})`;
        g.lineWidth = 2.4; g.lineCap = "round";
        g.beginPath(); g.moveTo(cx + Math.cos(a) * RR, cy + Math.sin(a) * RR); g.lineTo(cx + Math.cos(a) * (RR + len), cy + Math.sin(a) * (RR + len)); g.stroke();
      }
      // Face ID-style curved arrow: rides just outside the ring and points the way to the part still to fill.
      if (startedCircle && !doneAt && inside && lastLit >= 6) {
        let d = gapAng - arrowAng;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        arrowAng += d * 0.06;
        const dir = d >= 0 ? 1 : -1; // clockwise or back
        const AR = RR + 60, tail = arrowAng - dir * 0.6;
        const a = 0.6 + 0.35 * Math.sin(now / 260);
        g.strokeStyle = `rgba(255,255,255,${a.toFixed(2)})`; g.lineWidth = 7; g.lineCap = "round"; g.lineJoin = "round";
        g.beginPath(); g.arc(cx, cy, AR, Math.min(tail, arrowAng), Math.max(tail, arrowAng)); g.stroke();
        const tx = cx + Math.cos(arrowAng + dir * 0.13) * AR, ty = cy + Math.sin(arrowAng + dir * 0.13) * AR;
        const bx = (k: number) => cx + Math.cos(arrowAng - dir * 0.02) * (AR + k), by = (k: number) => cy + Math.sin(arrowAng - dir * 0.02) * (AR + k);
        g.beginPath(); g.moveTo(bx(-16), by(-16)); g.lineTo(tx, ty); g.lineTo(bx(16), by(16)); g.stroke();
      }
      // Done: keep a picture of the finished scan, then a green tick draws itself in the empty circle.
      if (doneAt && since > 380 && !snapshot) snapshot = cv.toDataURL("image/jpeg", 0.85);
      if (doneAt && since > 700) {
        const k = reduce ? 1 : ease((since - 700) / 450);
        const pts: [number, number][] = [[cx - 70, cy + 4], [cx - 18, cy + 56], [cx + 78, cy - 52]];
        const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
        const dist = k * (l1 + l2);
        g.strokeStyle = `rgb(${GREEN.join(",")})`; g.lineWidth = 16; g.lineCap = "round"; g.lineJoin = "round";
        g.beginPath(); g.moveTo(...pts[0]);
        if (dist <= l1) g.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * (dist / l1), pts[0][1] + (pts[1][1] - pts[0][1]) * (dist / l1));
        else { g.lineTo(...pts[1]); const q = (dist - l1) / l2; g.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * q, pts[1][1] + (pts[2][1] - pts[1][1]) * q); }
        g.stroke();
      }
      if (doneAt && since > 1900) {
        stopped = true;
        cancelAnimationFrame(raf);
        onDone([shots.front, shots.a, shots.b, shots.up, shots.down].filter((x): x is string => !!x), snapshot || undefined);
      }
    }
    return () => { stopped = true; clearTimeout(timeout); cancelAnimationFrame(raf); stream?.getTracks().forEach((x) => x.stop()); landmarker?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black px-6 py-10" role="dialog" aria-modal="true" aria-label={t("SuperScan")}>
      <button onClick={onClose} className="absolute start-4 top-4 z-10 min-h-[44px] px-2 text-[17px] text-[#0a84ff]">{t("Cancel")}</button>
      <video ref={video} playsInline muted className="hidden" />
      {stage === "error" ? (
        <div className="max-w-sm text-center text-white">
          <p>{msg}</p>
          <button onClick={onFallback} className="mt-5 min-h-[48px] rounded-full bg-white px-6 font-semibold text-ink">{t("Use a single camera shot instead")}</button>
        </div>
      ) : (
        <>
          <p className="mb-6 min-h-[3.2em] max-w-xs text-center text-[19px] font-semibold leading-snug text-white" aria-live="polite">{stage === "loading" ? t("Starting SuperScan…") : msg}</p>
          <div className="relative aspect-square" style={{ width: "min(100%, 400px, 62dvh)" }}>
            <canvas ref={canvas} className="h-full w-full" />
          </div>
          {stage !== "done" && (
            <>
              <p className="mt-6 max-w-xs text-center text-[13px] text-white/55">{t("Face a window, no make-up, hair back. Only the 5 finished photos are sent to read your skin, then deleted.")}</p>
              <button onClick={onFallback} className="mt-3 text-xs text-white/45 underline">{t("Use a single camera shot instead")}</button>
            </>
          )}
        </>
      )}
    </div>
  );
}
