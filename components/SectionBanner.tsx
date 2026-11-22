"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/site-context";

export type SectionBannerData = { banner: { title: string; text: string; cta: string; href: string; image: string; bg: string }; tips: string[]; app: { label: string; href: string } };

/** Ad banner + rotating tips + the section's app, at the top of each shop section (Admin → Sections & AI). */
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
    <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_340px]">
      <Link href={b.href || "/shop/"} className="banner-tile group relative flex min-h-[180px] items-center overflow-hidden rounded-3xl p-6 md:p-8" style={{ background: b.bg || "#fcf1f4" }}>
        <div className="relative z-10 max-w-[62%]">
          <p className="text-2xl font-bold leading-tight md:text-3xl">{tx(b.title)}</p>
          {b.text && <p className="mt-2 text-sm text-ink/80 md:text-base">{tx(b.text)}</p>}
          {b.cta && <span className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-ink px-5 text-sm font-semibold text-white">{tx(b.cta)}</span>}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {b.image && <img src={b.image} alt="" className="absolute bottom-0 end-2 h-[90%] max-w-[40%] object-contain transition duration-500 group-hover:scale-105" />}
      </Link>
      <div className="flex flex-col justify-between gap-3 rounded-3xl bg-[#f6f1f3] p-5">
        {s.tips.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{tx("Pharmacist tip")}</p>
            <p key={i} className="mt-2 min-h-[3.5rem] text-[15px] font-medium leading-snug">{tx(s.tips[i % s.tips.length])}</p>
            {s.tips.length > 1 && (
              <div className="mt-2 flex gap-1.5">
                {s.tips.map((_, n) => <button key={n} onClick={() => setI(n)} aria-label={`${tx("Tip")} ${n + 1}`} className={`h-2 rounded-full transition-all ${n === i ? "w-5 bg-ink" : "w-2 bg-ink/25"}`} />)}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {s.app.href && <Link href={s.app.href} className="inline-flex min-h-[44px] items-center rounded-full bg-white px-4 text-sm font-semibold hover:bg-ink hover:text-white">{tx(s.app.label)} →</Link>}
          <button onClick={() => window.dispatchEvent(new Event("open-advisor"))} className="inline-flex min-h-[44px] items-center rounded-full bg-white px-4 text-sm font-semibold hover:bg-ink hover:text-white">{tx("Ask AI")}</button>
        </div>
      </div>
    </div>
  );
}
