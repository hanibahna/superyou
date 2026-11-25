"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/site-context";

/** Slim ad + rotating tips for THIS product: pause/play, previous/next, copy and share on WhatsApp. */
export function TipLine({ tips: initial, slug, name, banner }: { tips: string[]; slug?: string; name?: string; banner: { title: string; cta: string; href: string; bg: string } }) {
  const t = useT();
  const [tips, setTips] = useState(initial);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/products/tips/?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => {
      if (Array.isArray(d.tips) && d.tips.length) setTips((cur) => [...cur, ...d.tips.filter((x: string) => !cur.includes(x))]);
    }).catch(() => {});
  }, [slug]);
  useEffect(() => {
    if (tips.length < 2 || paused) return;
    const x = setInterval(() => setI((n) => (n + 1) % tips.length), 7000);
    return () => clearInterval(x);
  }, [tips.length, paused]);
  const tip = tips.length ? t(tips[i % tips.length]) : "";
  const url = typeof window !== "undefined" ? window.location.href.split("#")[0] : "";
  const share = `💡 ${tip}${name ? `\n— ${name}` : ""}\n${url}`;
  const copy = async () => { try { await navigator.clipboard.writeText(share); setCopied(true); setPaused(true); setTimeout(() => setCopied(false), 1800); } catch {} };
  const go = (d: number) => { setPaused(true); setI((n) => (n + d + tips.length) % tips.length); };
  const btn = "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-ink shadow-sm hover:bg-[#fdecef]";
  if (!tips.length && !banner.href) return null;
  return (
    <div className="mb-5 grid gap-2 md:grid-cols-[1fr_auto]">
      {tips.length > 0 && (
        <div className="flex min-h-[44px] items-center gap-2 rounded-2xl bg-[#f6f1f3] px-3 py-2 text-sm">
          <b className="shrink-0 text-brand-700">💡 {t("Tip")}</b>
          <span key={i} className="sp-in min-w-0 flex-1" aria-live="polite">{tip}</span>
          <span className="flex shrink-0 items-center gap-1">
            {tips.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label={t("Previous tip")} className={btn}>‹</button>
                <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? t("Play tips") : t("Pause tips")} className={btn}>{paused ? "▶" : "❚❚"}</button>
                <button type="button" onClick={() => go(1)} aria-label={t("Next tip")} className={btn}>›</button>
                <span className="hidden px-1 text-[11px] tabular-nums text-muted sm:inline">{(i % tips.length) + 1}/{tips.length}</span>
              </>
            )}
            <button type="button" onClick={copy} aria-label={t("Copy tip")} className={btn}>{copied ? "✓" : "⧉"}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer" onClick={() => setPaused(true)} aria-label={t("Share tip on WhatsApp")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#25d366] text-white shadow-sm hover:bg-[#1ebe5b]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5.4 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 .9c.3.1.5.2.5.3.1.1.1.6-.1 1.1z" /></svg>
            </a>
          </span>
        </div>
      )}
      {banner.href && <Link href={banner.href} className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl px-4 py-2 text-sm font-semibold" style={{ background: banner.bg || "#fcf1f4" }}>{t(banner.title)}<span className="shrink-0 underline">{t(banner.cta)} →</span></Link>}
    </div>
  );
}
