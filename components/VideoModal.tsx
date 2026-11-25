"use client";

import { useEffect, useRef, useState } from "react";
import { useLang, useT } from "@/lib/site-context";

// Subtitle languages the shopper can pick. YouTube shows the video's own captions, or auto-translates
// them into the chosen language when the video has captions.
const CODES = ["en", "fr", "ar", "es", "de", "it", "pt", "ru", "tr", "hy", "el", "nl", "sv", "pl", "ro", "uk", "fa", "he", "ur", "hi", "bn", "id", "ms", "th", "vi", "tl", "ja", "ko", "zh-Hans", "zh-Hant", "sw", "am"];
const native = (c: string) => { try { return new Intl.DisplayNames([c], { type: "language" }).of(c) ?? c; } catch { return c; } };
const inEnglish = (c: string) => { try { return new Intl.DisplayNames(["en"], { type: "language" }).of(c) ?? c; } catch { return c; } };

/** A YouTube video in a pop-up over the page; ✕, Escape or a tap outside closes it. */
export function VideoModal({ id, title, lang, onClose }: { id: string; title: string; lang?: string; onClose: () => void }) {
  const t = useT();
  const site = useLang();
  const frame = useRef<HTMLIFrameElement>(null);
  const [cc, setCc] = useState<string>(() => { try { return localStorage.getItem("sy:subs") || site; } catch { return site; } });
  const [first] = useState(cc);
  const [voice, setVoice] = useState(false);
  // Switch subtitles live through YouTube's player API (no restart).
  const send = (func: string, args: unknown[]) => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  const pickCc = (v: string) => {
    setCc(v);
    try { localStorage.setItem("sy:subs", v); } catch {}
    if (v === "off") send("unloadModule", ["captions"]);
    else { send("loadModule", ["captions"]); send("setOption", ["captions", "track", { languageCode: v }]); }
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = o; };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3 md:p-8">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-4xl">
        <button onClick={onClose} aria-label={t("Close")} className="absolute -top-12 end-0 grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl">
          <iframe ref={frame} src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&hl=${encodeURIComponent(site)}${first === "off" ? "" : `&cc_load_policy=1&cc_lang_pref=${encodeURIComponent(first)}`}`} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white">
          {lang && <span className="rounded-full bg-white/15 px-3 py-1.5 font-semibold">🔊 {inEnglish(lang)}</span>}
          <label className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-ink">
            <span aria-hidden>CC</span>
            <select aria-label={t("Subtitles")} value={cc} onChange={(e) => pickCc(e.target.value)} className="max-w-[10rem] bg-transparent outline-none">
              <option value="off">{t("Subtitles off")}</option>
              {CODES.map((c) => <option key={c} value={c}>{native(c)}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setVoice((x) => !x)} aria-expanded={voice} className="rounded-full bg-white px-3 py-1.5 font-semibold text-ink">🎧 {t("Voice in another language")}</button>
        </div>
        {voice && (
          <p className="sp-in mt-2 rounded-xl bg-white/10 p-3 text-xs leading-relaxed text-white/90">
            {t("When YouTube has a dubbed voice for this video: tap the gear icon in the player › Audio track, and pick your language. In Chrome you can also switch on Live Translate (Settings › Accessibility) for on-device translation of any video.")}
          </p>
        )}
        <p className="mt-3 line-clamp-2 text-sm text-white/85">{title}</p>
      </div>
    </div>
  );
}
