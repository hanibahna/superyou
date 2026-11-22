"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/site-context";

/** Share this page: the phone's share sheet when available, else WhatsApp, Facebook, X, email or copy.
 * Club members' links carry their referral code, so friends get the welcome discount. */
export function ShareButton({ title, text, className = "", compact = false }: { title: string; text?: string; className?: string; compact?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);

  const url = () => {
    const u = new URL(window.location.href);
    ["v", "z", "r"].forEach((k) => u.searchParams.delete(k));
    let mine: string | null = null;
    try { mine = localStorage.getItem("sy:myref"); } catch {}
    if (mine) u.searchParams.set("ref", mine);
    u.searchParams.set("utm_source", "share");
    return u.toString();
  };
  const go = async () => {
    const link = url();
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try { await navigator.share({ title, text: text || title, url: link }); return; } catch { /* cancelled */ }
    }
    setOpen((o) => !o);
  };
  const msg = (l: string) => encodeURIComponent(`${text || title} ${l}`);
  const item = "flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-start text-sm font-medium hover:bg-[#f6f1f3]";
  return (
    <div ref={box} className={`relative ${className}`}>
      <button onClick={go} aria-label={t("Share")} aria-expanded={open} className={compact ? "grid h-11 w-11 place-items-center rounded-full border border-line bg-white hover:border-ink" : "inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold hover:border-ink"}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
        {!compact && t("Share")}
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-56 rounded-2xl border border-line bg-white p-1.5 shadow-xl">
          <a className={item} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${msg(url())}`}>WhatsApp</a>
          <a className={item} target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`}>Facebook</a>
          <a className={item} target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${msg(url())}`}>X</a>
          <a className={item} href={`mailto:?subject=${encodeURIComponent(title)}&body=${msg(url())}`}>{t("Email")}</a>
          <button className={item} onClick={async () => { await navigator.clipboard.writeText(url()).catch(() => {}); setCopied(true); setTimeout(() => (setCopied(false), setOpen(false)), 1200); }}>{copied ? t("Link copied ✓") : t("Copy link")}</button>
        </div>
      )}
    </div>
  );
}
