"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/site-context";
import { QuickHelp } from "./QuickHelp";

export type SectionBannerData = { banner: { title: string; text: string; cta: string; href: string; image: string; bg: string }; tips: string[]; app: { label: string; href: string } };

/**
 * Compact strip at the top of each shop section (Admin → Sections & AI): help buttons, a slim ad
 * banner and a rotating tip. Kept short so products start above the fold on phones, iPads and desktops.
 */
export function SectionBanner({ s }: { s: SectionBannerData }) {
  const tx = useT();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (s.tips.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % s.tips.length), 7000);
    return () => clearInterval(t);
  }, [s.tips.length]);
  const b = s.banner;
  return (
    <div className="mb-5 space-y-2.5">
      <QuickHelp />
      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
        <Link href={b.href || "/shop/"} className="banner-tile group flex min-h-[76px] items-center gap-3 overflow-hidden rounded-2xl py-2 pe-3 ps-4 md:gap-4 md:pe-4" style={{ background: b.bg || "#fcf1f4" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {b.image && <img src={b.image} alt="" className="h-14 w-14 shrink-0 object-contain transition duration-500 group-hover:scale-110 md:h-16 md:w-16" />}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-[15px] font-bold leading-tight md:text-lg">{tx(b.title)}</p>
            {b.text && <p className="mt-0.5 line-clamp-1 hidden text-[13px] text-ink/75 sm:block">{tx(b.text)}</p>}
          </div>
          {b.cta && <span className="inline-flex min-h-[40px] shrink-0 items-center rounded-full bg-ink px-4 text-[13px] font-semibold text-white">{tx(b.cta)}</span>}
        </Link>
        {(s.tips.length > 0 || s.app.href) && (
          <div className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-[#f6f1f3] px-4 py-2">
            {s.tips.length > 0 && (
              <p key={i} className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug">
                <b className="me-1.5 text-brand-700">{tx("Tip")}</b>{tx(s.tips[i % s.tips.length])}
              </p>
            )}
            {s.tips.length > 1 && (
              <button onClick={() => setI((n) => (n + 1) % s.tips.length)} aria-label={tx("Next tip")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="rtl-flip"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            )}
            {s.app.href && <Link href={s.app.href} className="hidden min-h-[36px] shrink-0 items-center rounded-full bg-white px-3 text-[13px] font-semibold hover:bg-ink hover:text-white sm:inline-flex">{tx(s.app.label)} →</Link>}
          </div>
        )}
      </div>
    </div>
  );
}
