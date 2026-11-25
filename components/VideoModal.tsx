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
  // Voice-over language: YouTube plays its dubbed audio track in the player's language when the video
  // has one (auto-dubbing / multi-language audio). Changing it reloads the player where it was.
  const [voice, setVoice] = useState<string>(() => { try { return localStorage.getItem("sy:voice") || site; } catch { return site; } });
  const [start, setStart] = useState(0);
  const [hint, setHint] = useState(false);
  const now = useRef(0);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
      try { const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; const ct = d?.info?.currentTime; if (typeof ct === "number") now.current = ct; } catch {}
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, []);
  const listen = () => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*");
  const pickVoice = (v: string) => {
    setStart(Math.floor(now.current));
    setVoice(v);
    setHint(true);
    setTimeout(() => setHint(false), 6000);
    try { localStorage.setItem("sy:voice", v); } catch {}
  };
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
          <iframe key={voice} ref={frame} onLoad={listen} src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&hl=${encodeURIComponent(voice)}${start ? `&start=${start}` : ""}${(cc === "off" ? "off" : first) === "off" ? "" : `&cc_load_policy=1&cc_lang_pref=${encodeURIComponent(cc === "off" ? first : cc)}`}`} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full" />
          {hint && (
            <span className="sp-in pointer-events-none absolute end-3 top-14 z-10 max-w-[15rem] rounded-xl bg-white px-3 py-2 text-xs font-semibold text-ink shadow-lg">
              <span className="absolute -top-1.5 end-6 h-3 w-3 rotate-45 bg-white" aria-hidden />
              {t("Not hearing it? Tap ⚙ › Audio track to pick the voice. Only videos with dubbed voices offer it.")}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white">
          <label className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-ink">
            <span aria-hidden>🔊</span>
            <select aria-label={t("Voice-over language")} value={voice} onChange={(e) => pickVoice(e.target.value)} className="max-w-[11rem] bg-transparent outline-none">
              {CODES.map((c) => <option key={c} value={c}>{t("Voice")}: {native(c)}{lang && c.startsWith(lang) ? ` (${t("original")})` : ""}</option>)}
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-ink">
            <span aria-hidden>CC</span>
            <select aria-label={t("Subtitles")} value={cc} onChange={(e) => pickCc(e.target.value)} className="max-w-[10rem] bg-transparent outline-none">
              <option value="off">{t("Subtitles off")}</option>
              {CODES.map((c) => <option key={c} value={c}>{native(c)}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-white/85">{title}</p>
      </div>
    </div>
  );
}
