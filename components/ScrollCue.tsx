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
  const down = p < 0.04;
  const go = () => scrollTo({ top: down ? Math.min(innerHeight * 0.85 + scrollY, document.documentElement.scrollHeight) : 0, behavior: "smooth" });
  const C = 2 * Math.PI * 21;
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px]">
        <div className="h-full origin-left bg-gradient-to-r from-[#c0587a] to-[#9b2c50] transition-transform duration-150" style={{ transform: `scaleX(${p})` }} />
      </div>
      {long && (
        <button
          type="button"
          onClick={go}
          aria-label={down ? t("Scroll down") : t("Back to top")}
          className={`scroll-cue fixed bottom-24 left-1/2 z-30 -translate-x-1/2 md:bottom-6 ${down ? "scroll-cue-down" : ""}`}
        >
          <svg width="48" height="48" viewBox="0 0 48 48" className="drop-shadow-lg">
            <circle cx="24" cy="24" r="21" fill="white" />
            <circle cx="24" cy="24" r="21" fill="none" stroke="#f3c4d2" strokeWidth="3" />
            <circle cx="24" cy="24" r="21" fill="none" stroke="#9b2c50" strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} transform="rotate(-90 24 24)" style={{ transition: "stroke-dashoffset .15s linear" }} />
            <path d={down ? "M17 21l7 7 7-7" : "M17 27l7-7 7 7"} fill="none" stroke="#111" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="scroll-cue-arrow" />
          </svg>
        </button>
      )}
    </>
  );
}
