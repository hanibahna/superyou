"use client";

import { useEffect, useState } from "react";
import { useLang, useT } from "@/lib/site-context";

type V = { id: string; title: string; channel: string; lang?: string };

// Subtitle languages the shopper can pick. YouTube shows the video's captions, or auto-translates
// them into this language when the video has captions.
const SUBS: [string, string][] = [["en", "English"], ["fr", "Français"], ["ar", "العربية"], ["es", "Español"], ["de", "Deutsch"], ["it", "Italiano"], ["pt", "Português"], ["ru", "Русский"], ["tr", "Türkçe"], ["hy", "Հայերեն"], ["zh-Hans", "中文"], ["ko", "한국어"], ["hi", "हिन्दी"]];
const langName = (code?: string) => {
  if (!code) return "";
  try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code; } catch { return code; }
};

/** Review and how-to videos from YouTube. Nothing loads from YouTube until the shopper taps play. */
export function ProductYouTube({ slug }: { slug: string }) {
  const tx = useT();
  const [videos, setVideos] = useState<V[]>([]);
  const [playing, setPlaying] = useState("");
  const site = useLang();
  const [sub, setSub] = useState<string>(site);
  useEffect(() => { try { const s = localStorage.getItem("sy:subs"); if (s) setSub(s); } catch {} }, []);
  const pick = (v: string) => { setSub(v); setPlaying(""); try { localStorage.setItem("sy:subs", v); } catch {} };
  useEffect(() => {
    fetch(`/api/products/videos/?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => setVideos(d.videos ?? [])).catch(() => {});
  }, [slug]);
  if (!videos.length) return null;
  return (
    <section className="container-x py-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">YouTube</p>
      <div className="mt-1 mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-semibold">{tx("Reviews & how-to videos")}</h2>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">CC {tx("Subtitles in")}</span>
          <select value={sub} onChange={(e) => pick(e.target.value)} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-medium">
            {SUBS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {videos.map((v) => (
          <div key={v.id} className="overflow-hidden rounded-2xl bg-[#f6f1f3]">
            <div className="relative aspect-video bg-black">
              {playing === v.id ? (
                <iframe src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1&cc_load_policy=1&cc_lang_pref=${encodeURIComponent(sub)}&hl=${encodeURIComponent(sub)}`} title={v.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" className="absolute inset-0 h-full w-full" />
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
              {v.lang && (
                <p className="mt-1.5 flex flex-wrap gap-1 text-[11px]">
                  <span className="rounded-full bg-white px-2 py-0.5 font-medium">🔊 {langName(v.lang)}</span>
                  {v.lang !== sub.slice(0, 2) && <span className="rounded-full bg-white px-2 py-0.5 font-medium">CC {SUBS.find(([c]) => c === sub)?.[1] ?? sub}</span>}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">{tx("Videos by independent creators on YouTube.")} {tx("Subtitles are translated by YouTube when the video has captions. Some videos also offer a translated voice track in the player's settings (gear icon › Audio track).")}</p>
    </section>
  );
}
