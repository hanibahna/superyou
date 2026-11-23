"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/site-context";

type V = { id: string; title: string; channel: string };
type Guide = { steps: string[]; when: string; goodFor: string; cautions: string[] };

/** "How to use", always open and highlighted on the product page: the stored AI guide for this exact
 * product (or the maker's directions), tips for this kind of product, and videos of this exact product. */
export function HowToUse({ slug, how, tips, initialGuide }: { slug: string; name: string; brand: string; how: string; tips: string[]; initialGuide?: Guide | null }) {
  const t = useT();
  const box = useRef<HTMLElement>(null);
  const [guide, setGuide] = useState<Guide | null | undefined>(initialGuide ?? undefined);
  const [videos, setVideos] = useState<V[] | null>(null);
  const [playing, setPlaying] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => { setOpen(true); setTimeout(() => box.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
    window.addEventListener("open-howto", h);
    return () => window.removeEventListener("open-howto", h);
  }, []);
  useEffect(() => {
    if (guide === undefined) fetch(`/api/products/guide/?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => setGuide(d.guide ?? null)).catch(() => setGuide(null));
    fetch(`/api/products/videos/?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => setVideos(d.videos ?? [])).catch(() => setVideos([]));
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = guide?.steps?.length ? guide.steps : [];
  if (guide !== undefined && !steps.length && !how && !tips.length && videos !== null && !videos.length) return null;
  return (
    <section ref={box} id="how-to-use" aria-labelledby="howto-h" className="mt-5 scroll-mt-28 rounded-3xl border-2 border-[#d13f74]/40 bg-gradient-to-br from-[#fdeef3] to-white p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="howto-body" className="flex w-full items-center gap-3 text-start">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d13f74] text-white" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9" /></svg>
        </span>
        <span className="flex-1">
          <span id="howto-h" className="block text-lg font-bold">{t("How to use")}</span>
          <span className="block text-xs text-muted">{[steps.length ? `${steps.length} ${t("steps")}` : "", tips.length || guide?.cautions?.length ? t("tips") : "", videos?.length ? t("videos") : ""].filter(Boolean).join(" · ") || t("Directions and tips")}</span>
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

      {videos && videos.length > 0 && (
        <div className="mt-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
            {playing ? (
              <iframe src={`https://www.youtube-nocookie.com/embed/${playing}?autoplay=1&rel=0&modestbranding=1`} title={videos.find((v) => v.id === playing)?.title ?? "Video"} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" className="absolute inset-0 h-full w-full" />
            ) : (
              <button onClick={() => setPlaying(videos[0].id)} aria-label={`${t("Play")}: ${videos[0].title}`} className="group absolute inset-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.ytimg.com/vi/${videos[0].id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-0 grid place-items-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-white/95 shadow-lg transition group-hover:scale-110"><svg width="22" height="22" viewBox="0 0 24 24" fill="#2e2229" aria-hidden><path d="M8 5v14l11-7z" /></svg></span></span>
              </button>
            )}
          </div>
          {videos.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {videos.map((v) => (
                <button key={v.id} onClick={() => setPlaying(v.id)} className={`w-40 shrink-0 overflow-hidden rounded-xl bg-white text-start text-xs ${playing === v.id ? "ring-2 ring-ink" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" className="aspect-video w-full object-cover" />
                  <span className="line-clamp-2 p-1.5 font-semibold">{v.title}</span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-1 text-[11px] text-muted">{t("Videos are by independent creators.")}</p>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted">{steps.length ? t("Written by SuperYou AI from this product's details. Always read the label; ask our pharmacist if unsure.") : t("Always read the label; ask our pharmacist if unsure.")}</p>
      </div>
    </section>
  );
}
