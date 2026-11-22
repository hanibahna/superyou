"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/site-context";

type V = { id: string; title: string; channel: string };

/** Review and how-to videos from YouTube. Nothing loads from YouTube until the shopper taps play. */
export function ProductYouTube({ slug }: { slug: string }) {
  const tx = useT();
  const [videos, setVideos] = useState<V[]>([]);
  const [playing, setPlaying] = useState("");
  useEffect(() => {
    fetch(`/api/products/videos/?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => setVideos(d.videos ?? [])).catch(() => {});
  }, [slug]);
  if (!videos.length) return null;
  return (
    <section className="container-x py-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">YouTube</p>
      <h2 className="mt-1 mb-4 text-2xl font-semibold">{tx("Reviews & how-to videos")}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {videos.map((v) => (
          <div key={v.id} className="overflow-hidden rounded-2xl bg-[#f6f1f3]">
            <div className="relative aspect-video bg-black">
              {playing === v.id ? (
                <iframe src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1`} title={v.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" className="absolute inset-0 h-full w-full" />
              ) : (
                <button onClick={() => setPlaying(v.id)} aria-label={`${tx("Play")}: ${v.title}`} className="group absolute inset-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-white/95 shadow-lg transition group-hover:scale-110">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#2e2229" aria-hidden><path d="M8 5v14l11-7z" /></svg>
                    </span>
                  </span>
                </button>
              )}
            </div>
            <div className="p-3">
              <p className="line-clamp-2 text-sm font-semibold leading-snug">{v.title}</p>
              {v.channel && <p className="mt-1 text-xs text-muted">{v.channel}</p>}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">{tx("Videos by independent creators on YouTube.")}</p>
    </section>
  );
}
