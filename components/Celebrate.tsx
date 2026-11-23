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
