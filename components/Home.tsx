"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Concern } from "@/lib/data/catalog";
import type { Slide } from "@/lib/site";
import { ChevronLeft, ChevronRight } from "./Icons";
import { NewsletterForm } from "./NewsletterForm";
import { VideoPlayer } from "./Video";

// ── Hero slider ─────────────────────────────────────────────
const heights = { small: "min-h-[240px] md:min-h-[300px]", medium: "min-h-[300px] md:min-h-[380px]", large: "min-h-[380px] md:min-h-[520px]" };

/** True for pale colours (hex), so the banner switches to dark text. */
function isLight(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? "");
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 186;
}

export function HeroSlider({ slides, interval = 6, height = "medium" }: { slides: Slide[]; interval?: number; height?: "small" | "medium" | "large" }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), interval * 1000);
    return () => clearInterval(t);
  }, [slides.length, interval]);
  if (!slides.length) return null;
  const s = slides[Math.min(i, slides.length - 1)];
  const cover = s.layout === "cover" && (s.image || s.video);
  // Light gradients (pastel banners) get dark text; dark ones and photo covers keep white text.
  const light = !cover && isLight(s.from) && isLight(s.to);
  return (
    <section className="container-x pt-5">
      <div className={`relative overflow-hidden rounded-2xl ${light ? "text-ink" : "text-white"}`} style={{ background: `linear-gradient(90deg, ${s.from}, ${s.to})` }}>
        {cover && (
          <div className="absolute inset-0">
            {s.video ? <VideoPlayer url={s.video} background poster={s.image} /> : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.image} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
          </div>
        )}
        <div className={`relative grid items-center gap-6 px-8 py-12 md:grid-cols-2 md:px-16 ${heights[height]}`}>
          <div>
            {s.eyebrow && <p className={`text-xs font-bold uppercase tracking-[0.25em] ${light ? "text-brand-700" : "opacity-80"}`}>{s.eyebrow}</p>}
            <h1 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">{s.title}</h1>
            {s.text && <p className="mt-3 text-lg opacity-90">{s.text}</p>}
            {s.cta && (
              <Link href={s.href || "/shop/"} className={`mt-6 inline-block rounded-full px-6 py-3 text-sm font-semibold ${light ? "bg-ink text-white hover:bg-black" : "bg-white text-ink hover:bg-brand-50"}`}>
                {s.cta}
              </Link>
            )}
          </div>
          {!cover && (s.image || s.video) && (
            <div className="-order-1 flex justify-center md:order-none md:justify-end">
              <div className={`w-full overflow-hidden rounded-2xl ${/\.svg($|\?)/i.test(s.image) ? "aspect-[4/3] max-w-[300px] md:max-w-md" : "hidden aspect-square max-w-sm md:block"}`}>
                {s.video ? <VideoPlayer url={s.video} background poster={s.image} /> : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt="" className="h-full w-full object-cover" />
                )}
              </div>
            </div>
          )}
        </div>
        {slides.length > 1 && (
          <>
            <button onClick={() => setI((i - 1 + slides.length) % slides.length)} aria-label="Previous slide" className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/20 p-2 hover:bg-white/30 md:block">
              <ChevronLeft />
            </button>
            <button onClick={() => setI((i + 1) % slides.length)} aria-label="Next slide" className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/20 p-2 hover:bg-white/30 md:block">
              <ChevronRight />
            </button>
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((_, n) => (
                <button key={n} onClick={() => setI(n)} aria-label={`Slide ${n + 1}`} className={`h-2 rounded-full transition-all ${n === i ? "w-6 bg-white" : "w-2 bg-white/50"}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ── Countdown ───────────────────────────────────────────────
export function Countdown({ eyebrow, title, endsAt, href }: { eyebrow: string; title: string; endsAt: string; href: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const end = () => {
      if (endsAt) return new Date(endsAt).getTime();
      const d = new Date();
      d.setHours(24, 0, 0, 0); // no end date: counts down to midnight every day
      return d.getTime();
    };
    const tick = () => setLeft(Math.max(0, end() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (left === 0) return null;
  const s = Math.floor((left ?? 0) / 1000);
  const parts = [
    ["Days", Math.floor(s / 86400)],
    ["Hours", Math.floor((s % 86400) / 3600)],
    ["Minutes", Math.floor((s % 3600) / 60)],
    ["Seconds", s % 60],
  ] as const;
  const body = (
    <>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold md:text-3xl">{title}</h2>
      <div dir="ltr" className="mt-5 flex justify-center gap-3">
        {parts.map(([label, v]) => (
          <div key={label} className="w-20 rounded-xl bg-ink py-3 text-white">
            <p className="text-2xl font-bold tabular-nums">{left === null ? "--" : String(v).padStart(2, "0")}</p>
            <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
          </div>
        ))}
      </div>
    </>
  );
  return <section className="hsec container-x pt-10 text-center">{href ? <Link href={href} className="block">{body}</Link> : body}</section>;
}

// ── Shop by concern ─────────────────────────────────────────
export function ShopByConcern({ concerns, counts, eyebrow = "Got concerns? We got you", title = "Shop by concern" }: { concerns: Concern[]; counts: Record<string, number>; eyebrow?: string; title?: string }) {
  const [group, setGroup] = useState<"skin" | "hair" | "wellness">("skin");
  const list = concerns.filter((c) => c.group === group);
  const groups = (["skin", "hair", "wellness"] as const).filter((g) => concerns.some((c) => c.group === g));
  const tints = ["#fcf1f4", "#fdf1e7", "#f3eef8", "#eef3fb", "#fff8e1", "#eef6f1"];
  return (
    <section className="hsec container-x py-10">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-semibold md:text-3xl">{title}</h2>
        <div className="flex rounded-full border border-line p-1 text-sm">
          {groups.map((g) => (
            <button key={g} onClick={() => setGroup(g)} className={`rounded-full px-4 py-1.5 capitalize ${group === g ? "bg-brand-500 text-white" : "text-muted"}`}>
              {g}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {list.map((c, n) => (
          <Link
            key={c.slug}
            href={`/shop/?concern=${c.slug}`}
            className="overflow-hidden rounded-xl transition hover:-translate-y-0.5 hover:shadow-md"
            style={{ background: tints[n % tints.length] }}
          >
            {c.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.image} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
            )}
            <div className="p-5 pt-4">
            <p className="font-semibold">{c.name}</p>
            <p className="mt-1 text-xs text-muted">{(counts[c.slug] ?? 0).toLocaleString("en-US")} products</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Brand strip ─────────────────────────────────────────────
export function BrandStrip({ brands, title = "Shop by brand", logos = {} }: { brands: string[]; title?: string; logos?: Record<string, string> }) {
  return (
    <section className="hsec container-x py-10">
      {title && <h2 className="mb-5 text-2xl font-semibold md:text-3xl">{title}</h2>}
      <div className="no-scrollbar flex gap-3 overflow-x-auto">
        {brands.map((b) => (
          <Link
            key={b}
            href={`/shop/?brand=${encodeURIComponent(b)}`}
            className="grid h-20 min-w-40 place-items-center rounded-xl border border-line bg-white px-6 text-center font-serif text-lg font-semibold tracking-[0.15em] text-ink transition hover:border-ink hover:shadow-sm"
          >
            {logos[b.toLowerCase()] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logos[b.toLowerCase()]} alt={b} loading="lazy" className="max-h-10 max-w-32 object-contain" />
            ) : b.toUpperCase()}
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Category tiles ──────────────────────────────────────────
export function CategoryTiles({ eyebrow, title, tiles }: { eyebrow: string; title: string; tiles: { slug: string; name: string; image?: string; count: number }[] }) {
  if (!tiles.length) return null;
  return (
    <section className="hsec container-x py-10">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>}
      {title && <h2 className="mb-5 mt-1 text-2xl font-semibold md:text-3xl">{title}</h2>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((c) => (
          <Link key={c.slug} href={`/shop/?category=${c.slug}`} className="pcard group overflow-hidden rounded-xl border border-line bg-white">
            <div className="aspect-square overflow-hidden bg-brand-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.image ? <img src={c.image} alt="" className="h-full w-full object-contain p-3 transition group-hover:scale-105" loading="lazy" /> : <span className="grid h-full place-items-center text-3xl font-bold text-brand-500">{c.name[0]}</span>}
            </div>
            <p className="px-3 pt-2 font-semibold">{c.name}</p>
            <p className="px-3 pb-3 text-xs text-muted">{c.count.toLocaleString("en-US")} products</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Promo banners ───────────────────────────────────────────
export function Banners({ title, columns, items }: { title: string; columns: 1 | 2 | 3; items: { image: string; video: string; title: string; text: string; href: string }[] }) {
  const cols = { 1: "", 2: "md:grid-cols-2", 3: "md:grid-cols-3" }[columns];
  return (
    <section className="hsec container-x py-8">
      {title && <h2 className="mb-5 text-2xl font-semibold md:text-3xl">{title}</h2>}
      <div className={`grid gap-4 ${cols}`}>
        {items.map((b, n) => (
          <Link key={n} href={b.href || "/shop/"} className={`group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-ink text-white ${columns === 1 ? "aspect-[21/8]" : "aspect-[16/9]"}`}>
            {b.video ? <div className="absolute inset-0"><VideoPlayer url={b.video} background poster={b.image} /></div> : b.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
            ) : null}
            {(b.title || b.text) && (
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 via-black/10 to-transparent p-6">
                {b.title && <p className="text-xl font-bold md:text-2xl">{b.title}</p>}
                {b.text && <p className="mt-1 text-sm opacity-90">{b.text}</p>}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Video section ───────────────────────────────────────────
export function VideoSection({ eyebrow, title, text, url, poster, autoplay, cta, href }: { eyebrow: string; title: string; text: string; url: string; poster: string; autoplay: boolean; cta: string; href: string }) {
  if (!url) return null;
  const hasText = eyebrow || title || text || cta;
  return (
    <section className="hsec container-x py-10">
      <div className={`grid items-center gap-8 ${hasText ? "lg:grid-cols-[1fr_1.4fr]" : ""}`}>
        {hasText && (
          <div>
            {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>}
            {title && <h2 className="mt-1 text-2xl font-semibold md:text-3xl">{title}</h2>}
            {text && <p className="mt-3 whitespace-pre-line text-muted">{text}</p>}
            {cta && <Link href={href || "/shop/"} className="mt-5 inline-block rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600">{cta}</Link>}
          </div>
        )}
        <div className="aspect-video overflow-hidden rounded-2xl bg-black">
          <VideoPlayer url={url} poster={poster} autoplay={autoplay} title={title || "Video"} />
        </div>
      </div>
    </section>
  );
}

// ── Text block ──────────────────────────────────────────────
export function TextBlock({ eyebrow, title, body, align, cta, href, background }: { eyebrow: string; title: string; body: string; align: "left" | "center"; cta: string; href: string; background: "none" | "soft" | "dark" }) {
  const bg = { none: "", soft: "bg-brand-50", dark: "bg-ink text-white" }[background];
  return (
    <section className="hsec container-x py-8">
      <div className={`rounded-2xl px-6 py-10 md:px-12 ${bg} ${align === "center" ? "text-center" : ""}`}>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>}
        {title && <h2 className="mt-1 text-2xl font-semibold md:text-3xl">{title}</h2>}
        {body && <p className={`mt-3 whitespace-pre-line ${background === "dark" ? "opacity-80" : "text-muted"} ${align === "center" ? "mx-auto max-w-2xl" : "max-w-3xl"}`}>{body}</p>}
        {cta && <Link href={href || "/shop/"} className="mt-5 inline-block rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600">{cta}</Link>}
      </div>
    </section>
  );
}

// ── Newsletter ──────────────────────────────────────────────
export function NewsletterSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="hsec mt-8 bg-ink py-12 text-white">
      <div className="container-x grid items-center gap-6 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-sale">SuperYou</p>
          <h2 className="mt-2 text-3xl font-black md:text-4xl">{title}</h2>
          {text && <p className="mt-2 max-w-md text-white/70">{text}</p>}
        </div>
        <div className="max-w-md md:justify-self-end md:w-full"><NewsletterForm dark /></div>
      </div>
    </section>
  );
}

// ── TikTok profile feed (official TikTok creator embed) ─────
export function TikTokProfile({ handle, eyebrow, title }: { handle: string; eyebrow: string; title: string }) {
  const h = handle.replace(/^@/, "");
  useEffect(() => {
    const id = "tiktok-embed-js";
    document.getElementById(id)?.remove();
    const s = document.createElement("script");
    s.id = id;
    s.async = true;
    s.src = "https://www.tiktok.com/embed.js";
    document.body.appendChild(s);
  }, [h]);
  if (!h) return null;
  return (
    <section className="hsec container-x py-10">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>}
      {title && <h2 className="mb-5 mt-1 text-2xl font-semibold md:text-3xl">{title}</h2>}
      <blockquote className="tiktok-embed" cite={`https://www.tiktok.com/@${h}`} data-unique-id={h} data-embed-type="creator" style={{ maxWidth: 780, minWidth: 288, margin: "0 auto" }}>
        <section>
          <a target="_blank" rel="noreferrer" href={`https://www.tiktok.com/@${h}?refer=creator_embed`}>@{h} on TikTok</a>
        </section>
      </blockquote>
    </section>
  );
}
