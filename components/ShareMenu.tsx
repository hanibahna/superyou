"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/site-context";

/** A colourful share button that opens a small menu: WhatsApp, Copy, and the phone's own share sheet. */
export function ShareMenu({ text, className = "", size = 32, align = "end", onOpen }: { text: string; className?: string; size?: number; align?: "start" | "end"; onOpen?: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => { setCopied(false); setOpen(false); }, 1200); } catch {} };
  const native = typeof navigator !== "undefined" && "share" in navigator;
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm font-semibold hover:bg-[#f6f1f3]";
  return (
    <span ref={box} className={`relative inline-flex ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); onOpen?.(); }}
        aria-label={t("Share")}
        aria-expanded={open}
        style={{ width: size, height: size }}
        className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ff7aa8] to-[#9b2c50] text-white shadow-md transition hover:scale-105"
      >
        <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
      </button>
      {open && (
        <span role="menu" className={`sp-in absolute top-full z-50 mt-2 w-48 rounded-xl border border-line bg-white p-1.5 shadow-xl ${align === "end" ? "end-0" : "start-0"}`}>
          <a role="menuitem" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={item}>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#25d366] text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5.4 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 .9c.3.1.5.2.5.3.1.1.1.6-.1 1.1z" /></svg>
            </span>
            WhatsApp
          </a>
          <button role="menuitem" type="button" onClick={copy} className={item}>
            <span className={`grid h-7 w-7 place-items-center rounded-full text-white ${copied ? "bg-[#046c4e]" : "bg-[#6c5ce7]"}`}>{copied ? "✓" : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg>}</span>
            {copied ? t("Copied") : t("Copy")}
          </button>
          {native && (
            <button role="menuitem" type="button" onClick={() => { navigator.share({ text }).catch(() => {}); setOpen(false); }} className={item}>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#f59e0b] text-white">⋯</span>
              {t("More…")}
            </button>
          )}
        </span>
      )}
    </span>
  );
}
