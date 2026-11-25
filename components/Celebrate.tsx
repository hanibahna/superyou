"use client";

// Small celebration burst (confetti), used when a goal is reached: free delivery unlocked, order placed, tier up.
// No library; skipped when the site's motion setting is off or the visitor prefers reduced motion.
export function celebrate(opts: { x?: number; y?: number; count?: number } = {}) {
  if (typeof window === "undefined") return;
  if (document.documentElement.dataset.motion === "off" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#c0587a", "#111111", "#ffc2d4", "#e48aa9", "#f6d365", "#ffffff"];
  const n = opts.count ?? 70;
  const ox = opts.x ?? window.innerWidth / 2;
  const oy = opts.y ?? window.innerHeight / 3;
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(layer);
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    const size = 6 + Math.random() * 6;
    const angle = Math.random() * Math.PI * 2;
    const speed = 180 + Math.random() * 320;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed - 260;
    p.style.cssText = `position:absolute;left:${ox}px;top:${oy}px;width:${size}px;height:${size * (Math.random() > 0.5 ? 1 : 0.45)}px;background:${colors[i % colors.length]};border-radius:${Math.random() > 0.6 ? "50%" : "2px"};box-shadow:0 0 0 1px rgba(0,0,0,.04)`;
    layer.appendChild(p);
    p.animate(
      [{ transform: "translate(0,0) rotate(0deg)", opacity: 1 }, { transform: `translate(${dx}px,${dy + 700}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 }],
      { duration: 1400 + Math.random() * 900, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" },
    );
  }
  setTimeout(() => layer.remove(), 2600);
  try { navigator.vibrate?.(30); } catch {}
}

/** Confetti that grows with the prize: 1 = small pop … 4 = cannons from both sides, a long rain and a second wave. */
export function celebrateLevel(level: number, origin?: { x: number; y: number }) {
  if (typeof window === "undefined") return;
  if (document.documentElement.dataset.motion === "off" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const W = window.innerWidth, H = window.innerHeight;
  const o = origin ?? { x: W / 2, y: H / 3 };
  celebrate({ ...o, count: 50 + level * 25 });
  if (level >= 2) setTimeout(() => celebrate({ ...o, count: 80 }), 350);
  if (level >= 3) {
    setTimeout(() => cannon(0, H * 0.85, 1, 70), 200);
    setTimeout(() => cannon(W, H * 0.85, -1, 70), 200);
  }
  if (level >= 4) {
    setTimeout(() => rain(160), 500);
    setTimeout(() => { cannon(0, H * 0.6, 1, 90); cannon(W, H * 0.6, -1, 90); }, 1100);
    setTimeout(() => celebrate({ ...o, count: 140 }), 1500);
  }
  try { navigator.vibrate?.(level >= 3 ? [40, 60, 40, 60, 80] : 30); } catch {}
}

const COLORS = ["#c0587a", "#111111", "#ffc2d4", "#e48aa9", "#f6d365", "#ffffff", "#7fd1b9"];
function layerFor(ms: number) {
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), ms);
  return layer;
}
function piece(layer: HTMLElement, x: number, y: number, i: number) {
  const p = document.createElement("i");
  const size = 6 + Math.random() * 7;
  p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size * (Math.random() > 0.5 ? 1 : 0.45)}px;background:${COLORS[i % COLORS.length]};border-radius:${Math.random() > 0.6 ? "50%" : "2px"}`;
  layer.appendChild(p);
  return p;
}
/** Side cannon: a jet of confetti fired up and across the screen. */
function cannon(x: number, y: number, dir: 1 | -1, n: number) {
  const layer = layerFor(3200);
  for (let i = 0; i < n; i++) {
    const p = piece(layer, x, y, i);
    const a = (-Math.PI / 2) + dir * (0.25 + Math.random() * 0.6);
    const v = 500 + Math.random() * 450;
    p.animate(
      [{ transform: "translate(0,0) rotate(0)", opacity: 1 }, { transform: `translate(${Math.cos(a) * v}px,${Math.sin(a) * v}px) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.45 }, { transform: `translate(${Math.cos(a) * v * 1.3}px,${Math.sin(a) * v + 650}px) rotate(${Math.random() * 1080}deg)`, opacity: 0 }],
      { duration: 2200 + Math.random() * 900, easing: "cubic-bezier(.15,.7,.35,1)", fill: "forwards" },
    );
  }
}
/** Confetti rain falling from the top, swaying. */
function rain(n: number) {
  const layer = layerFor(4200);
  const W = window.innerWidth, H = window.innerHeight;
  for (let i = 0; i < n; i++) {
    const p = piece(layer, Math.random() * W, -20, i);
    const sway = (Math.random() - 0.5) * 160;
    p.animate(
      [{ transform: "translate(0,0) rotate(0)" }, { transform: `translate(${sway}px,${H / 2}px) rotate(${Math.random() * 360}deg)`, offset: 0.5 }, { transform: `translate(${-sway}px,${H + 40}px) rotate(${Math.random() * 900}deg)` }],
      { duration: 2400 + Math.random() * 1500, delay: Math.random() * 700, easing: "linear", fill: "forwards" },
    );
  }
}
