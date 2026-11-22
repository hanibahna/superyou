"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/site-context";

type V = { id: string; title: string; channel: string };

/** "How to use" button: a pop-up with the directions, pharmacist tips and how-to videos for this product. */
export function HowToUse({ slug, name, brand, how, tips }: { slug: string; name: string; brand: string; how: string; tips: string[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [videos, setVideos] = useState<V[] | null>(null);
  const [playing, setPlaying] = useState("");
  useEffect(() => {
    if (!open || videos) return;
    fetch(`/api/products/videos/?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => setVideos(d.videos ?? [])).catch(() => setVideos([]));
  }, [open, videos, slug]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open]);
  const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${brand} ${name} how to use`)}`;
  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-ink px-4 text-sm font-semibold hover:bg-ink hover:text-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
        {t("How to use")}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={t("How to use")} className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 md:items-center" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 md:max-w-2xl md:rounded-3xl md:p-7">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{t("How to use")}</p>
                <h2 className="mt-1 text-xl font-bold leading-tight">{brand} {name}</h2>
              </div>
              <button onClick={() => setOpen(false)} aria-label={t("Close")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f6f1f3]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            {videos === null ? <div className="skeleton aspect-video rounded-2xl" /> : videos.length > 0 && (
              <div className="space-y-3">
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
                  <div className="flex gap-2 overflow-x-auto">
                    {videos.map((v) => (
                      <button key={v.id} onClick={() => setPlaying(v.id)} className={`w-40 shrink-0 overflow-hidden rounded-xl text-start text-xs ${playing === v.id ? "ring-2 ring-ink" : ""}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" className="aspect-video w-full object-cover" />
                        <span className="line-clamp-2 p-1.5 font-semibold">{v.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {how && (
              <div className="mt-5">
                <h3 className="font-bold">{t("Directions")}</h3>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{how}</p>
              </div>
            )}
            {tips.length > 0 && (
              <div className="mt-5 rounded-2xl bg-[#f6f1f3] p-4">
                <h3 className="font-bold">{t("Pharmacist tips")}</h3>
                <ul className="mt-2 space-y-1.5 text-sm">{tips.map((x) => <li key={x} className="flex gap-2"><span aria-hidden>•</span><span>{x}</span></li>)}</ul>
              </div>
            )}
            {!how && !tips.length && videos?.length === 0 && <p className="text-sm text-muted">{t("Follow the directions on the pack, or ask our pharmacist on WhatsApp.")}</p>}

            <div className="mt-5 flex flex-wrap gap-2">
              <a href={yt} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white">{videos?.length ? t("More videos on YouTube") : t("Watch how-to videos on YouTube")}</a>
              <a href="/services/?book=video-consult" className="inline-flex min-h-[44px] items-center rounded-full border border-line px-4 text-sm font-semibold">{t("Ask a pharmacist on video")}</a>
            </div>
            <p className="mt-3 text-xs text-muted">{t("Videos are by independent creators. Always read the label, and ask a pharmacist if you're unsure.")}</p>
          </div>
        </div>
      )}
    </>
  );
}
