"use client";

import { useT } from "@/lib/site-context";

// Sephora-style homepage blocks: campaign hero, promo cards, round category pictures, offers grid.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { imgUrl } from "@/lib/img";
import type { Tile } from "@/lib/site";
import { useSettings } from "@/lib/site-context";
import { useShop } from "@/lib/store";
import { ChevronLeft, ChevronRight } from "./Icons";
import { BfLogo } from "./BfLogo";

const Img = ({ src, w, className = "", eager = false }: { src: string; w: number; className?: string; eager?: boolean }) =>
  src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imgUrl(src, w)} alt="" loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} className={className} />
  ) : (
    <span className={`block bg-brand-50 ${className}`} />
  );

function useCountdown(endsAt: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    const end = new Date(endsAt).getTime();
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  return left;
}

/** Campaign hero: black panel, huge headline, product collage, optional countdown. */
type HeroProduct = { id: string; slug: string; name: string; brand: string; price: number; compareAt?: number; size: string; variant?: string; image?: string; shape: "bottle" | "tube" | "jar" | "dropper" | "spray" | "box" | "tub"; color: string; inStock: boolean; variantCount?: number };

export function CampaignHero(p: { eyebrow: string; title: string; text: string; badge: string; cta: string; href: string; cta2: string; href2: string; endsAt: string; images: Tile[]; slider?: { enabled: boolean; interval: number }; products?: HeroProduct[]; video?: string; poster?: string; overlay?: number; live?: { day: number; days: number; startsAt: string; endsAt: string; daily: boolean } }) {
  const settings = useSettings();
  const tx = useT();
  const left = useCountdown(p.endsAt);
  const s = Math.floor((left ?? 0) / 1000);
  const parts = [["d", Math.floor(s / 86400)], ["h", Math.floor((s % 86400) / 3600)], ["m", Math.floor((s % 3600) / 60)], ["s", s % 60]] as const;
  const imgs = p.images.filter((t) => t.image).slice(0, 6);
  // Black Friday is on (Admin → Black Friday): the hero switches to its animated night look.
  const live = p.live;
  const progress = live && left !== null ? Math.min(100, Math.max(2, (1 - left / Math.max(1, Date.parse(live.endsAt) - Date.parse(live.startsAt))) * 100)) : 0;
  const lastDay = live && left !== null && left < 864e5;
  return (
    <section className={`bf-hero ${p.video ? "has-video" : ""} ${live ? "bf-live" : ""} relative overflow-hidden bg-black text-white`}>
      {live && <><span className="bf-glow" aria-hidden /><span className="bf-sparkles" aria-hidden /></>}
      {p.video && <HeroVideo src={p.video} poster={p.poster} overlay={p.overlay ?? 50} />}
      <div className="container-x relative grid items-center gap-8 py-10 md:py-14 lg:grid-cols-[1fr_1.1fr]">
        <div>
          {live ? <BfLogo className="bf-logo h-20 w-auto text-white max-md:hidden md:h-24" /> : p.eyebrow && <p className="bf-eyebrow inline-block border border-white/40 px-3 py-1 text-xs font-bold uppercase tracking-[0.3em]">{p.eyebrow}</p>}
          <h1 className="bf-title mt-5 text-5xl font-black uppercase leading-[0.95] tracking-tight md:text-7xl">{highlight(p.title)}</h1>
          {p.text && <p className="bf-text mt-4 max-w-md text-lg text-white/80">{p.text}</p>}
          {live && (
            <div className="bf-day mt-4 max-w-md">
              <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest">
                <span className={lastDay ? "bf-blink text-sale" : ""}>{lastDay ? tx("Last day") : `${tx("Day")} ${live.day} / ${live.days}`}</span>
                {live.daily && <span className="text-white/70 max-md:hidden">{tx("A new deal unlocks every day")}</span>}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="bf-bar h-full rounded-full" style={{ width: `${progress}%` }} /></div>
            </div>
          )}
          {p.endsAt && left !== null && left > 0 && (
            <div dir="ltr" className={`mt-6 flex items-end gap-2 ${live ? "max-md:hidden" : ""}`}>
              {parts.map(([k, v]) => (
                <div key={k} className="text-center">
                  <div key={live ? `${k}${v}` : k} className={`bf-count w-16 rounded bg-white/10 py-2 text-3xl font-bold tabular-nums ${live ? "bf-tick" : ""}`}>{String(v).padStart(2, "0")}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-widest text-white/60">{{ d: tx("days"), h: tx("hours"), m: tx("mins"), s: tx("secs") }[k]}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-7 flex flex-wrap gap-3 max-md:mt-5 max-md:flex-nowrap max-md:gap-2">
            {p.cta && <Link href={p.href || "/shop/"} className="bf-cta1 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-black hover:bg-brand-100">{p.cta}</Link>}
            {p.cta2 && <Link href={p.href2 || "/shop/"} className="bf-cta2 rounded-full border border-white/60 px-7 py-3.5 text-sm font-bold hover:bg-white/10">{p.cta2}</Link>}
          </div>
          <p className="bf-trust mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
            <span>✓ {tx("Pay on delivery")}</span>
            {settings.delivery.freeThreshold > 0 && <span>✓ {tx("Free delivery over")} ${settings.delivery.freeThreshold}</span>}
            <span>✓ {tx("Free pharmacist advice")}</span>
          </p>
        </div>
        {p.slider?.enabled && (p.products?.length ?? 0) >= 4 ? (
          <HeroMarquee products={p.products!} seconds={p.slider.interval} />
        ) : imgs.length > 0 && (
          <HeroMarquee tiles={imgs} seconds={p.slider?.interval ?? 3.5} />
        )}
      </div>
      {p.badge && (
        <div className="bf-ticker overflow-hidden border-y border-white/15 bg-black py-2">
          <div className="marquee flex w-max gap-10 whitespace-nowrap text-sm font-bold uppercase tracking-[0.25em]">
            {/* The hero already sells the offer, so the ticker carries the trust promises. */}
            {Array.from({ length: 4 }).flatMap((_, i) => [
              tx("100% original products"),
              tx("Pay cash on delivery"),
              settings.delivery.freeThreshold > 0 ? `${tx("Free delivery over")} $${settings.delivery.freeThreshold}` : tx("Fast delivery all over Lebanon"),
              tx("Free pharmacist advice"),
            ].map((line, j) => <span key={`${i}-${j}`}>{line} <span className="text-sale">✦</span></span>))}
          </div>
        </div>
      )}
    </section>
  );
}

/** "Up to *70%* off" → the starred words in the rose accent colour. */
export function highlight(text: string) {
  return text.split(/(\*[^*]+\*)/g).map((part, i) => (part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <span key={i} className="text-sale">{part.slice(1, -1)}</span> : part));
}

/** Muted looping background video. Skipped (poster only) on data saver or "reduce motion". */
function HeroVideo({ src, poster, overlay }: { src: string; poster?: string; overlay: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [play, setPlay] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPlay(true);
  }, []);
  const file = /\.(mp4|webm|mov)(\?|$)/i.test(src);
  return (
    <>
      {play && file ? (
        <video ref={ref} className="hero-video" src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" aria-hidden />
      ) : poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="hero-video" />
      ) : null}
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay / 100})` }} />
      {play && file && (
        <button
          onClick={() => { const v = ref.current; if (!v) return; if (v.paused) (v.play(), setPaused(false)); else (v.pause(), setPaused(true)); }}
          aria-label={paused ? "Play background video" : "Pause background video"}
          className="absolute bottom-14 end-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/20 text-sm text-white backdrop-blur hover:bg-white/30"
        >
          {paused ? "▶" : "❚❚"}
        </button>
      )}
    </>
  );
}

/** Two rows of products gliding to the left without stopping; pauses on hover or touch. */
function HeroMarquee({ products, tiles, seconds }: { products?: HeroProduct[]; tiles?: Tile[]; seconds: number }) {
  const { add } = useShop();
  const items: { key: string; href: string; image?: string; badge: string; title: string; price?: string; was?: string; product?: HeroProduct }[] = products
    ? products.filter((x) => x.image).map((x) => {
        const pct = x.compareAt && x.compareAt > x.price ? Math.round((1 - x.price / x.compareAt) * 100) : 0;
        return { key: x.id, href: `/products/${x.slug}/`, image: x.image, badge: pct ? `-${pct}%` : "", title: x.brand, price: `$${x.price.toFixed(2)}`, was: pct ? `$${x.compareAt!.toFixed(2)}` : undefined, product: x };
      })
    : (tiles ?? []).map((t, i) => ({ key: String(i), href: t.href || "/shop/", image: t.image, badge: t.badge, title: t.title }));
  if (!items.length) return null;
  const half = Math.ceil(items.length / 2);
  const rows = items.length >= 6 ? [items.slice(0, half), items.slice(half)] : [items];
  return (
    <div className="hero-marquee relative -mx-4 overflow-hidden md:mx-0" style={{ maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)" }}>
      {rows.map((row, r) => (
        <div key={r} dir="ltr" className={`hero-track flex w-max gap-3 ${r ? "mt-3" : ""}`} style={{ animationDuration: `${Math.max(12, row.length * seconds)}s`, animationDelay: r ? `-${(row.length * seconds) / 2}s` : undefined }}>
          {[...row, ...row].map((t, i) => (
            <div key={`${t.key}-${i}`} aria-hidden={i >= row.length} className="group relative aspect-square w-40 shrink-0 overflow-hidden rounded-lg bg-white text-ink sm:w-48 lg:w-52">
              <Link href={t.href} tabIndex={i >= row.length ? -1 : 0} aria-label={[t.product ? `${t.product.brand} ${t.product.name}` : t.title, t.price].filter(Boolean).join(", ")} className="block h-full w-full">
                <Img eager={r === 0 && i < 3} src={t.image ?? ""} w={420} className="h-full w-full object-contain p-4 pb-12 transition duration-500 group-hover:scale-105" />
              </Link>
              {t.badge && <span dir="ltr" className="absolute start-2 top-2 rounded bg-sale px-2 py-1 text-xs font-bold text-white">{t.badge}</span>}
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-8 text-white">
                <div className="min-w-0 text-xs leading-tight">
                  <p className="truncate font-semibold">{t.title}</p>
                  {t.price && <p><b>{t.price}</b>{t.was && <span className="ms-1 text-white/60 line-through">{t.was}</span>}</p>}
                </div>
                {t.product && t.product.inStock && (t.product.variantCount ?? 1) <= 1 && (
                  <button onClick={() => add(t.product!)} tabIndex={i >= row.length ? -1 : 0} aria-label={`Add ${t.product.name} to bag`} className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-black opacity-90 hover:opacity-100">+ Add</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Scroller({ children, label }: { children: React.ReactNode; label: string }) {
  const tx = useT();
  const ref = useRef<HTMLDivElement>(null);
  const by = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="relative">
      <div ref={ref} className="no-scrollbar flex snap-x gap-4 overflow-x-auto pb-1" aria-label={label}>{children}</div>
      <button onClick={() => by(-1)} aria-label={tx("Previous")} className="absolute -left-4 top-1/3 hidden h-10 w-10 place-items-center rounded-full bg-white shadow-md hover:bg-brand-50 md:grid"><ChevronLeft /></button>
      <button onClick={() => by(1)} aria-label={tx("Next")} className="absolute -right-4 top-1/3 hidden h-10 w-10 place-items-center rounded-full bg-white shadow-md hover:bg-brand-50 md:grid"><ChevronRight /></button>
    </div>
  );
}

/** Promo cards (Sephora's homepage carousel of coloured cards). */
export function PromoTiles({ eyebrow, title, items }: { eyebrow: string; title: string; items: Tile[] }) {
  return (
    <section className="hsec container-x pt-6">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>}
      {title && <h2 className="mb-4 text-2xl font-bold">{title}</h2>}
      <Scroller label={title || "Promotions"}>
        {items.map((t, i) => (
          <Link key={i} href={t.href || "/shop/"} className="promo-tile group w-[78%] shrink-0 snap-start overflow-hidden rounded-lg sm:w-[45%] lg:w-[calc(25%-12px)]" style={{ background: t.bg || "#f5f0eb" }}>
            <div className="relative aspect-[4/3]">
              <Img src={t.image} w={600} className="absolute inset-0 h-full w-full object-contain p-6 mix-blend-multiply transition duration-500 group-hover:scale-105" />
              {t.badge && <span className="absolute left-3 top-3 rounded bg-black px-2 py-1 text-xs font-bold uppercase tracking-wider text-white">{t.badge}</span>}
            </div>
            <div className="px-4 pb-5 pt-1">
              <p className="text-lg font-bold leading-snug">{t.title}</p>
              {t.text && <p className="mt-1 text-sm text-ink/75">{t.text}</p>}
              {t.cta && <p className="mt-3 text-sm font-bold underline-offset-4 group-hover:underline">{t.cta} ▸</p>}
            </div>
          </Link>
        ))}
      </Scroller>
    </section>
  );
}

/** Round category pictures. */
export function Circles({ title, items }: { title: string; items: Tile[] }) {
  return (
    <section className="hsec container-x py-8">
      {title && <h2 className="mb-5 text-2xl font-bold">{title}</h2>}
      <div className="no-scrollbar flex gap-5 overflow-x-auto pb-2 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(92px,1fr))] lg:gap-3 lg:overflow-visible">
        {items.map((t, i) => (
          <Link key={i} href={t.href || "/shop/"} className="group w-24 shrink-0 text-center lg:w-auto">
            <span className="circle-pic mx-auto block aspect-square w-full max-w-[120px] overflow-hidden rounded-full border border-line" style={{ background: t.bg || "#f6f6f6" }}>
              <Img src={t.image} w={300} className="h-full w-full object-contain p-4 mix-blend-multiply transition duration-300 group-hover:scale-110" />
            </span>
            <span className="circle-label mt-2 block text-sm font-semibold group-hover:underline">{t.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Offers grid (picture + bold title + details + link). */
export function OffersGrid({ eyebrow, title, items }: { eyebrow: string; title: string; items: Tile[] }) {
  return (
    <section className="hsec container-x py-8">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>}
      {title && <h2 className="mb-5 text-2xl font-bold">{title}</h2>}
      <div className={`grid gap-4 sm:grid-cols-2 ${items.length % 4 === 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {items.map((t, i) => (
          <Link key={i} href={t.href || "/shop/"} className={`offer-tile group flex gap-4 rounded-lg border border-line bg-white p-4 transition hover:shadow-md ${items.length % 4 === 0 ? "lg:flex-col" : ""}`}>
            <span className={`relative block h-28 w-28 shrink-0 overflow-hidden rounded ${items.length % 4 === 0 ? "lg:h-40 lg:w-full" : ""}`} style={{ background: t.bg || "#f6f6f6" }}>
              <Img src={t.image} w={280} className="h-full w-full object-contain p-2 mix-blend-multiply" />
            </span>
            <span className="flex min-w-0 flex-col">
              {t.badge && <span className="mb-1 w-fit rounded bg-sale px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">{t.badge}</span>}
              <span className="font-bold leading-snug">{t.title}</span>
              {t.text && <span className="mt-1 text-sm text-muted">{t.text}</span>}
              {t.cta && <span className="mt-auto pt-2 text-sm font-bold group-hover:underline">{t.cta} ▸</span>}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
