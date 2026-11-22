"use client";

import { useEffect } from "react";
import { useT } from "@/lib/site-context";

/** A YouTube video in a pop-up over the page; ✕, Escape or a tap outside closes it. */
export function VideoModal({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  const t = useT();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = o; };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3 md:p-8">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-4xl">
        <button onClick={onClose} aria-label={t("Close")} className="absolute -top-12 end-0 grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl">
          <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full" />
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-white/85">{title}</p>
      </div>
    </div>
  );
}
