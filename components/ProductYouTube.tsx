"use client";

import { useEffect, useState } from "react";
import { useLang, useT } from "@/lib/site-context";

type V = { id: string; title: string; channel: string; lang?: string };

// Subtitle languages the shopper can pick. YouTube shows the video's captions, or auto-translates
// them into this language when the video has captions.
const CODES = ["en", "fr", "ar", "es", "de", "it", "pt", "ru", "tr", "hy", "el", "nl", "sv", "pl", "ro", "uk", "fa", "he", "ur", "hi", "bn", "id", "ms", "th", "vi", "tl", "ja", "ko", "zh-Hans", "zh-Hant", "sw", "am"];
const native = (c: string) => { try { return new Intl.DisplayNames([c], { type: "language" }).of(c) ?? c; } catch { return c; } };
const SUBS: [string, string][] = CODES.map((c) => [c, native(c)]);
const langName = (code?: string) => {
  if (!code) return "";
  try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code; } catch { return code; }
};

/** Review and how-to videos from YouTube. Nothing loads from YouTube until the shopper taps play. */
export function ProductYouTube({ slug }: { slug: string }) {
  const tx = useT();
  const [videos, setVideos] = useState<V[]>([]);
  const [playing, setPlaying] = useState("");
  const [per, setPer] = useState<Record<string, string>>({});
  const [voice, setVoice] = useState("");
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
          <span className="text-muted">CC {tx("Subtitles for all videos")}</span>
          <select value={sub} onChange={(e) => pick(e.target.value)} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-medium">
            <option value="off">{tx("Off")}</option>
            {SUBS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {videos.map((v) => (
          <div key={v.id + (per[v.id] ?? sub)} className="overflow-hidden rounded-2xl bg-[#f6f1f3]">
            <div className="relative aspect-video bg-black">
              {playing === v.id ? (
                <iframe src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1${(per[v.id] ?? sub) === "off" ? "" : `&cc_load_policy=1&cc_lang_pref=${encodeURIComponent(per[v.id] ?? sub)}`}&hl=${encodeURIComponent(site)}`} title={v.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" className="absolute inset-0 h-full w-full" />
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
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                {v.lang && <span className="rounded-full bg-white px-2 py-1 font-medium">🔊 {langName(v.lang)}</span>}
                <label className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 font-medium">
                  <span aria-hidden>CC</span>
                  <select aria-label={tx("Subtitles for this video")} value={per[v.id] ?? sub} onChange={(e) => { const val = e.target.value; setPer((x) => ({ ...x, [v.id]: val })); }} className="max-w-[9rem] bg-transparent outline-none">
                    <option value="off">{tx("Off")}</option>
                    {SUBS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => setVoice(voice === v.id ? "" : v.id)} className="rounded-full bg-white px-2 py-1 font-medium" aria-expanded={voice === v.id}>🎧 {tx("Voice")}</button>
              </div>
              {voice === v.id && (
                <p className="sp-in mt-2 rounded-lg bg-white p-2 text-[11px] leading-relaxed text-muted">
                  {tx("Play the video, then tap the gear icon › Audio track to switch to a dubbed voice when YouTube offers one for this video. In Chrome you can also turn on Live Translate in the browser settings for on-device translation.")}
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
