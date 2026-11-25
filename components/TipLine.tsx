"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/site-context";
import { ShareMenu } from "./ShareMenu";

/** Slim ad + rotating tips for THIS product: pause/play, previous/next, copy and share on WhatsApp. */
export function TipLine({ tips: initial, slug, name, banner }: { tips: string[]; slug?: string; name?: string; banner: { title: string; cta: string; href: string; bg: string } }) {
  const t = useT();
  const [tips, setTips] = useState(initial);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
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
  const go = (d: number) => { setPaused(true); setI((n) => (n + d + tips.length) % tips.length); };
  const btn = "grid h-8 w-8 shrink-0 place-items-center rounded-full text-white shadow-md transition hover:scale-105";
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
                <button type="button" onClick={() => go(-1)} aria-label={t("Previous tip")} className={`${btn} bg-[#f59e0b]`}>‹</button>
                <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? t("Play tips") : t("Pause tips")} className={`${btn} ${paused ? "bg-[#046c4e]" : "bg-[#c0587a]"}`}>{paused ? "▶" : "❚❚"}</button>
                <button type="button" onClick={() => go(1)} aria-label={t("Next tip")} className={`${btn} bg-[#0ea5e9]`}>›</button>
                <span className="hidden rounded-full bg-white px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#9b2c50] sm:inline">{(i % tips.length) + 1}/{tips.length}</span>
              </>
            )}
            <ShareMenu text={share} onOpen={() => setPaused(true)} />
          </span>
        </div>
      )}
      {banner.href && <Link href={banner.href} className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl px-4 py-2 text-sm font-semibold" style={{ background: banner.bg || "#fcf1f4" }}>{t(banner.title)}<span className="shrink-0 underline">{t(banner.cta)} →</span></Link>}
    </div>
  );
}
