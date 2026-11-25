"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/lib/site-context";

/** Whole-page scrolling: a thin progress bar on top, and a round button that bounces "scroll down"
 * at the top of a long page and turns into "back to top" (with a progress ring) once scrolled. */
export function ScrollCue() {
  const t = useT();
  const path = usePathname();
  const [p, setP] = useState(0);
  const [long, setLong] = useState(false);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - innerHeight;
      setLong(max > innerHeight * 0.6);
      setP(max > 0 ? Math.min(1, scrollY / max) : 0);
    };
    on();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    const id = setInterval(on, 1500); // pages that grow as products stream in
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); clearInterval(id); };
  }, [path]);
  if (path.startsWith("/checkout")) return null;
  const atTop = p < 0.02, atEnd = p > 0.98;
  const step = (d: 1 | -1) => scrollBy({ top: d * innerHeight * 0.85, behavior: "smooth" });
  const btn = "grid h-10 w-10 place-items-center rounded-full transition disabled:cursor-default disabled:opacity-30";
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px]">
        <div className="h-full origin-left bg-gradient-to-r from-[#c0587a] to-[#9b2c50] transition-transform duration-150" style={{ transform: `scaleX(${p})` }} />
      </div>
      {long && (
        <div className="fixed bottom-32 end-5 z-30 hidden flex-col items-center gap-1 rounded-full border border-line bg-white/95 p-1 shadow-lg backdrop-blur md:flex">
          <button type="button" onClick={() => step(-1)} onDoubleClick={() => scrollTo({ top: 0, behavior: "smooth" })} disabled={atTop} aria-label={t("Scroll up")} className={`${btn} ${atTop ? "text-muted" : "bg-[#9b2c50] text-white hover:bg-[#7d2341]"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 15l6-6 6 6" /></svg>
          </button>
          <span className="relative h-12 w-1 overflow-hidden rounded-full bg-[#f3c4d2]" aria-hidden>
            <span className="absolute inset-x-0 top-0 rounded-full bg-[#9b2c50] transition-[height] duration-150" style={{ height: `${Math.max(8, p * 100)}%` }} />
          </span>
          <button type="button" onClick={() => step(1)} onDoubleClick={() => scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })} disabled={atEnd} aria-label={t("Scroll down")} className={`${btn} ${atEnd ? "text-muted" : `bg-[#9b2c50] text-white hover:bg-[#7d2341] ${atTop ? "scroll-cue-down" : ""}`}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
      )}
    </>
  );
}
