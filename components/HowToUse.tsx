"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/site-context";
import { VideoModal } from "./VideoModal";

type V = { id: string; title: string; channel: string; lang?: "en" | "fr" | "ar" };
const LANGS = [["en", "English"], ["fr", "Français"], ["ar", "العربية"]] as const;
type Guide = { steps: string[]; when: string; goodFor: string; cautions: string[]; source?: string };

/** "How to use", always open and highlighted on the product page: the stored AI guide for this exact
 * product (or the maker's directions), tips for this kind of product, and videos of this exact product. */
export function HowToUse({ slug, how, tips, initialGuide }: { slug: string; name: string; brand: string; how: string; tips: string[]; initialGuide?: Guide | null }) {
  const t = useT();
  const box = useRef<HTMLElement>(null);
  const [guide, setGuide] = useState<Guide | null | undefined>(initialGuide ?? undefined);
  const [videos, setVideos] = useState<V[] | null>(null);
  const [playing, setPlaying] = useState("");
  const [vlang, setVlang] = useState<string>("");
  // One open at a time: videos open by default; opening How to use closes them, and the other way round.
  const [sec, setSec] = useState<"videos" | "how" | null>("videos");
  const open = sec === "how";
  const setOpen = (f: (o: boolean) => boolean) => setSec((cur) => (f(cur === "how") ? "how" : null));
  useEffect(() => {
    const h = () => { setSec("how"); setTimeout(() => box.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
    window.addEventListener("open-howto", h);
    return () => window.removeEventListener("open-howto", h);
  }, []);
  useEffect(() => {
    if (guide === undefined) fetch(`/api/products/guide/?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => setGuide(d.guide ?? null)).catch(() => setGuide(null));
    fetch(`/api/products/videos/?slug=${encodeURIComponent(slug)}&v=7`).then((r) => r.json()).then((d) => setVideos(d.videos ?? [])).catch(() => setVideos([]));
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = guide?.steps?.length ? guide.steps : [];
  if (guide !== undefined && !steps.length && !how && !tips.length && videos !== null && !videos.length) return null;
  return (
    <>
    <section ref={box} id="how-to-use" aria-labelledby="howto-h" className="mt-3 scroll-mt-28 rounded-2xl border-2 border-[#d13f74]/40 bg-gradient-to-br from-[#fdeef3] to-white p-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="howto-body" className="flex w-full items-center gap-3 text-start">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d13f74] text-white" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9" /></svg>
        </span>
        <span className="flex-1">
          <span id="howto-h" className="block text-lg font-bold">{t("How to use")}</span>
          <span className="block text-xs text-muted">{[steps.length ? `${steps.length} ${t("steps")}` : "", tips.length || guide?.cautions?.length ? t("tips") : ""].filter(Boolean).join(" · ") || t("Directions and tips")}</span>
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div id="howto-body" hidden={!open}>
      {guide?.when && <p className="mt-3 inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#d13f74] ring-1 ring-[#d13f74]/30">{guide.when}</p>}
      {guide?.goodFor && <p className="mt-2 text-sm text-muted">{guide.goodFor}</p>}

      {guide === undefined && !how ? (
        <div className="mt-3 space-y-2" aria-hidden><div className="skeleton h-4 w-11/12 rounded" /><div className="skeleton h-4 w-9/12 rounded" /><div className="skeleton h-4 w-10/12 rounded" /></div>
      ) : steps.length ? (
        <ol className="mt-3 space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      ) : how ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{how}</p>
      ) : null}

      {(tips.length > 0 || !!guide?.cautions?.length) && (
        <ul className="mt-4 space-y-1.5 rounded-2xl bg-white/80 p-3 text-sm">
          {tips.map((x) => <li key={x} className="flex gap-2"><span aria-hidden className="text-[#d13f74]">✦</span><span>{x}</span></li>)}
          {guide?.cautions?.map((x) => <li key={x} className="flex gap-2"><span aria-hidden>⚠︎</span><span>{x}</span></li>)}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-muted">{steps.length ? (guide?.source ? `${t("Based on the manufacturer's directions")} (${guide.source}), ${t("formatted by SuperYou AI. Always read the label.")}` : t("Formatted by SuperYou AI from this product's details. Always read the label.")) : t("Always read the label; ask our pharmacist if unsure.")}</p>
      </div>
    </section>
    {playing && <VideoModal id={playing} title={videos?.find((v) => v.id === playing)?.title ?? "Video"} onClose={() => setPlaying("")} />}
    {videos === null && (
      <p className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-line bg-white p-3 text-xs text-muted" aria-live="polite">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden />{t("Looking for videos of this exact product…")}
      </p>
    )}
    {videos && videos.length > 0 && (
      <section aria-labelledby="videos-h" className="mt-3 rounded-2xl border-2 border-line bg-white p-3">
        <button type="button" onClick={() => setSec((c) => (c === "videos" ? null : "videos"))} aria-expanded={sec === "videos"} aria-controls="videos-body" className="flex w-full items-center gap-3 text-start">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-white" aria-hidden><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
          <span className="flex-1">
            <span id="videos-h" className="block text-lg font-bold">{t("Videos")}</span>
            <span className="block text-xs text-muted">{videos.length} {videos.length === 1 ? t("video of this product") : t("videos of this product")} · {LANGS.filter(([k]) => videos.some((v) => v.lang === k)).map(([, l]) => l).join(" · ") || t("independent creators")}</span>
          </span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className={`shrink-0 transition-transform ${sec === "videos" ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div id="videos-body" hidden={sec !== "videos"}>
          {(() => {
            const langs = LANGS.filter(([k]) => videos.some((v) => v.lang === k));
            const cur = vlang && langs.some(([k]) => k === vlang) ? vlang : langs[0]?.[0] ?? "";
            const shown = cur ? videos.filter((v) => v.lang === cur) : videos;
            return (
              <>
                {langs.length > 1 && (
                  <div role="tablist" aria-label={t("Video language")} className="mt-3 flex gap-2">
                    {langs.map(([k, label]) => (
                      <button key={k} role="tab" aria-selected={cur === k} onClick={() => setVlang(k)} lang={k} className={`min-h-[36px] rounded-full px-3 text-xs font-semibold ${cur === k ? "bg-ink text-white" : "bg-[#f6f1f3]"}`}>
                        {label} ({videos.filter((v) => v.lang === k).length})
                      </button>
                    ))}
                  </div>
                )}
                {langs.length === 1 && <p className="mt-2 text-xs font-semibold text-muted" lang={langs[0][0]}>{langs[0][1]}</p>}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {shown.slice(0, 3).map((v) => (
                    <button key={v.id} onClick={() => setPlaying(v.id)} aria-label={`${t("Play")}: ${v.title}`} className="group text-start" dir={v.lang === "ar" ? "rtl" : undefined}>
                      <span className="relative block aspect-video overflow-hidden rounded-xl bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
                        <span className="absolute inset-0 grid place-items-center"><span className="grid h-8 w-8 place-items-center rounded-full bg-white/95 shadow"><svg width="12" height="12" viewBox="0 0 24 24" fill="#2e2229" aria-hidden><path d="M8 5v14l11-7z" /></svg></span></span>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[11px] font-medium leading-tight" lang={v.lang}>{v.title}</span>
                      {v.channel && <span className="block truncate text-[10px] text-muted">{v.channel}</span>}
                    </button>
                  ))}
                </div>
              </>
            );
          })()}
          <p className="mt-3 rounded-xl bg-[#f6f1f3] p-2.5 text-[11px] leading-snug text-muted">{t("Disclaimer: these videos are made by independent creators on YouTube, not by SuperYou or the brand, and are shown for information only. Opinions, claims and results in them are the creators' own and may not apply to you. Always follow the product label and directions, patch-test new products, and ask our pharmacist or your doctor if you're unsure. SuperYou isn't responsible for third-party content.")}</p>
        </div>
      </section>
    )}
    </>
  );
}
