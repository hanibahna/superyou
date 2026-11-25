"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/site-context";
import { VideoModal } from "./VideoModal";

type V = { id: string; title: string; channel: string; lang?: string };

/** Review and how-to videos right under the product photo. Plays in place; nothing loads from YouTube
 * until tapped. Without videos, a slim card opens the How to use pop-up. */
export function ImageVideos({ slug, brand, name }: { slug: string; brand: string; name: string }) {
  const t = useT();
  const [videos, setVideos] = useState<V[] | null>(null);
  const [playing, setPlaying] = useState("");
  useEffect(() => {
    fetch(`/api/products/videos/?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => setVideos(d.videos ?? [])).catch(() => setVideos([]));
  }, [slug]);
  const openHow = () => window.dispatchEvent(new Event("open-howto"));

  if (videos === null) return null;
  if (!videos.length)
    return (
      <button onClick={openHow} className="howto-glow mt-3 flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-[#f6f1f3] px-4 text-start hover:bg-[#efe7ea]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t("How to use")} · {t("videos & tips")}</span><span className="block truncate text-xs text-muted">{brand} {name}</span></span>
      </button>
    );

  return (
    <div className="mt-3">
      {playing && <VideoModal id={playing} title={videos.find((v) => v.id === playing)?.title ?? "Video"} lang={videos.find((v) => v.id === playing)?.lang} onClose={() => setPlaying("")} />}
      <p className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted">
        <span>{t("Reviews & how-to videos")}</span>
        <button onClick={openHow} className="howto-glow rounded-full px-2 py-1 font-bold text-ink underline-offset-2 hover:underline">▶ {t("How to use")}</button>
      </p>
      <div className="grid grid-cols-3 gap-2">
        {videos.slice(0, 3).map((v) => (
          <button key={v.id} onClick={() => setPlaying(v.id)} aria-label={`${t("Play")}: ${v.title}`} className="group relative aspect-video overflow-hidden rounded-xl bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
            <span className="absolute inset-0 grid place-items-center"><span className="grid h-8 w-8 place-items-center rounded-full bg-white/95 shadow"><svg width="12" height="12" viewBox="0 0 24 24" fill="#2e2229" aria-hidden><path d="M8 5v14l11-7z" /></svg></span></span>
          </button>
        ))}
      </div>
    </div>
  );
}
