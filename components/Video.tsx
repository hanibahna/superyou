"use client";

import { useT } from "@/lib/site-context";

import { useState } from "react";
import { imgUrl } from "@/lib/img";
import { parseVideo } from "@/lib/site";
import { useShop } from "@/lib/store";

/** Plays an uploaded file, YouTube, Vimeo, TikTok, Instagram or Facebook video. */
export function VideoPlayer({ url, poster, autoplay = false, background = false, className = "", title = "Video" }: { url: string; poster?: string; autoplay?: boolean; background?: boolean; className?: string; title?: string }) {
  const v = parseVideo(url, { autoplay, background });
  if (!v) return null;
  if (v.kind === "file")
    return (
      <video
        src={v.src}
        poster={poster || undefined}
        className={`h-full w-full object-cover ${className}`}
        controls={!background}
        autoPlay={autoplay || background}
        muted={autoplay || background}
        loop={background}
        playsInline
        preload="metadata"
      />
    );
  return (
    <iframe
      src={v.embed}
      title={title}
      className={`h-full w-full border-0 ${background ? "pointer-events-none" : ""} ${className}`}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      loading="lazy"
    />
  );
}

export function isVertical(url: string) {
  const v = parseVideo(url);
  return !!v && v.kind !== "file" && !!v.vertical;
}

export function thumbFor(url: string, thumbnail?: string) {
  if (thumbnail) return thumbnail;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  return yt ? `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` : "";
}

const badge: Record<string, string> = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", vimeo: "Vimeo", file: "Video" };

type StripVideo = { id: string; url: string; title: string; thumbnail: string; products?: string[] };

/** Row of video cards; tapping one plays it in a pop-up. */
export function VideoStrip({ videos, title, eyebrow }: { videos: StripVideo[]; title?: string; eyebrow?: string }) {
  const [open, setOpen] = useState<StripVideo | null>(null);
  if (!videos.length) return null;
  return (
    <section className="hsec py-6">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>}
      {title && <h2 className="mb-4 text-2xl font-semibold">{title}</h2>}
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
        {videos.map((v) => {
          const t = thumbFor(v.url, v.thumbnail);
          const kind = parseVideo(v.url)?.kind ?? "file";
          return (
            <button key={v.id} onClick={() => setOpen(v)} className="group relative aspect-[9/16] w-40 shrink-0 overflow-hidden rounded-xl bg-ink text-left text-white md:w-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t ? <img src={t} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90 transition group-hover:scale-105" /> : <span className="absolute inset-0 bg-gradient-to-b from-brand-500 to-ink" />}
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
              <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold">{badge[kind]}</span>
              <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow">▶</span>
              <span className="absolute bottom-2 left-2 right-2 line-clamp-3 text-xs font-semibold">{v.title}</span>
            </button>
          );
        })}
      </div>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4" onClick={() => setOpen(null)}>
          <div className={`relative w-full ${isVertical(open.url) ? "max-w-sm aspect-[9/16]" : "max-w-4xl aspect-video"}`} onClick={(e) => e.stopPropagation()}>
            <VideoPlayer url={open.url} autoplay title={open.title} className="rounded-xl bg-black" />
            <button onClick={() => setOpen(null)} className="absolute -top-10 right-0 text-sm font-semibold text-white">Close ✕</button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Videos playing right on the page: a scrollable row of vertical players (TikTok / Reels style). */
export function VideoWall({ videos, title, eyebrow, shop }: { videos: StripVideo[]; title?: string; eyebrow?: string; shop?: Record<string, ShopItem> }) {
  if (!videos.length) return null;
  return (
    <section className="hsec py-6">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>}
      {title && <h2 className="mb-4 text-2xl font-bold">{title}</h2>}
      <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto pb-2">
        {videos.map((v) => {
          const vert = isVertical(v.url) || parseVideo(v.url)?.kind === "file";
          return (
            <figure key={v.id} className={`shrink-0 snap-start ${vert ? "w-[260px] md:w-[300px]" : "w-[420px] md:w-[520px]"}`}>
              <div className={`overflow-hidden rounded-xl bg-black ${vert ? "aspect-[9/16]" : "aspect-video"}`}>
                <VideoPlayer url={v.url} title={v.title} poster={v.thumbnail} />
              </div>
              {v.title && <figcaption className="mt-2 line-clamp-2 text-sm font-medium">{v.title}</figcaption>}
              {shop && (v.products ?? []).map((slug) => shop[slug]).filter(Boolean).slice(0, 2).map((p) => <ShopChip key={p.id} p={p} />)}
            </figure>
          );
        })}
      </div>
    </section>
  );
}

type ShopItem = { id: string; slug: string; name: string; brand: string; price: number; compareAt?: number; size: string; variant?: string; image?: string; shape: "bottle" | "tube" | "jar" | "dropper" | "spray" | "box" | "tub"; color: string; inStock: boolean; variantCount?: number };

/** Product under a shoppable video: photo, price and one-tap add (or choose a size). */
function ShopChip({ p }: { p: ShopItem }) {
  const tx = useT();
  const { add } = useShop();
  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl border border-line p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {p.image ? <img src={imgUrl(p.image, 96)} alt="" className="h-11 w-11 rounded bg-white object-contain" /> : <span className="h-11 w-11 rounded bg-[#f5f5f5]" />}
      <a href={`/products/${p.slug}/`} className="min-w-0 flex-1 text-xs leading-tight"><span className="block truncate text-muted">{p.brand}</span><span className="line-clamp-1 font-medium">{p.name}</span><b>${p.price.toFixed(2)}</b></a>
      {(p.variantCount ?? 1) > 1 ? (
        <a href={`/products/${p.slug}/`} className="rounded-full border border-ink px-3 py-1.5 text-xs font-semibold">{tx("Choose")}</a>
      ) : (
        <button onClick={() => add(p)} disabled={!p.inStock} className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{tx("Add")}</button>
      )}
    </div>
  );
}
