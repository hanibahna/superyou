"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import { useT } from "@/lib/site-context";
import type { BfPublic } from "@/lib/bf-public";

// Black Friday on the shop: a live countdown strip, a door a day on the homepage, and confetti on add-to-cart.

const KEYFRAMES = `
@keyframes bf-shine{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes bf-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes bf-wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-3deg)}75%{transform:rotate(3deg)}}
@keyframes bf-pop{0%{transform:rotateY(90deg);opacity:0}100%{transform:rotateY(0);opacity:1}}
@keyframes bf-fall{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--dx),110vh) rotate(var(--r));opacity:.2}}
@media (prefers-reduced-motion:reduce){.bf-anim{animation:none!important}}
`;

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
const pad = (n: number) => String(n).padStart(2, "0");
function left(to: number, now: number) {
  const s = Math.max(0, Math.floor((to - now) / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, total: s };
}
function Clock({ to }: { to: string }) {
  const now = useNow();
  const l = left(Date.parse(to), now);
  return <span className="font-mono tabular-nums">{l.d > 0 ? `${l.d}d ` : ""}{pad(l.h)}:{pad(l.m)}:{pad(l.s)}</span>;
}

// One fetch of the Black Friday state per page, shared by the strip, product page and cart.
let bfCache: Promise<BfPublic | null> | null = null;
export function useBf() {
  const [b, setB] = useState<BfPublic | null>(null);
  useEffect(() => {
    bfCache ??= fetch("/api/bf/").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    bfCache.then((j) => {
      setB(j);
      if (j?.phase === "live" && j.fx.confetti) document.documentElement.dataset.bfConfetti = "1";
    });
  }, []);
  return b;
}

/** Sticky bar on every page while Black Friday is coming or on. */
export function BfStrip() {
  const t = useT();
  const b = useBf();
  const now = useNow();
  if (!b || !b.fx.strip || (b.phase !== "soon" && b.phase !== "live")) return null;
  const s = Date.parse(b.startsAt), e = Date.parse(b.endsAt);
  const progress = b.phase === "live" ? Math.min(100, ((now - s) / (e - s)) * 100) : 0;
  const lastDay = b.phase === "live" && e - now < 864e5;
  const finalHours = b.phase === "live" && e - now < 3 * 3600e3;
  if (b.phase === "live" && now >= e) return null;
  return (
    <Link href="/shop/?bf=1" className="relative block overflow-hidden bg-black text-white">
      <style>{KEYFRAMES}</style>
      <div className="bf-anim pointer-events-none absolute inset-0 opacity-30" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)", backgroundSize: "200% 100%", animation: "bf-shine 3.5s linear infinite" }} />
      <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
        <span className={`bf-anim rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${finalHours ? "bg-sale" : "bg-white text-black"}`} style={lastDay ? { animation: "bf-pulse 1s ease-in-out infinite" } : undefined}>
          {b.phase === "soon" ? t("Black Friday") : finalHours ? t("Final hours") : lastDay ? t("Last day") : `${t("Black Friday")} · ${t("Day")} ${b.day}/${b.days}`}
        </span>
        <span>{b.phase === "soon" ? t("Starts in") : t("Ends in")} <b><Clock to={b.phase === "soon" ? b.startsAt : b.endsAt} /></b></span>
        <span className="font-semibold underline underline-offset-4">{t("Shop the deals")} →</span>
      </div>
      {b.phase === "live" && <div className="absolute bottom-0 left-0 h-0.5 bg-white/80 transition-[width] duration-1000" style={{ width: `${progress}%` }} />}
    </Link>
  );
}

/** Homepage: one door per Black Friday day; today's opens with its spotlight product, later ones count down. */
export function BfDoors({ b }: { b: BfPublic }) {
  const t = useT();
  const router = useRouter();
  const now = useNow();
  useEffect(() => {
    const next = b.phase === "soon" ? Date.parse(b.startsAt) : b.nextUnlock ? Date.parse(b.nextUnlock) : 0;
    if (next && now >= next) router.refresh();
  }, [now, b, router]);
  if (!b.fx.daily || !b.doors.length || (b.phase !== "soon" && b.phase !== "live")) return null;
  const today = b.doors.find((d) => d.today);
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <style>{KEYFRAMES}</style>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">{t("Black Friday")}</p>
          <h2 className="text-2xl font-bold">{t("A new pick unlocks every day")}</h2>
        </div>
        {b.nextUnlock && <p className="text-sm">{t("Next door opens in")} <b><Clock to={b.nextUnlock} /></b></p>}
        {b.phase === "soon" && <p className="text-sm">{t("Door 1 opens in")} <b><Clock to={b.startsAt} /></b></p>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {b.doors.map((d) => d.open && d.deal ? (
          <Link key={d.day} href={`/products/${d.deal.slug}/`} className={`bf-anim group relative flex flex-col rounded-2xl border bg-white p-3 transition hover:shadow-lg ${d.today ? "border-black ring-2 ring-black sm:col-span-2 lg:col-span-2" : "border-line"}`} style={{ animation: "bf-pop .6s ease-out both" }}>
            <span className="absolute start-2 top-2 z-10 rounded-full bg-black px-2 py-0.5 text-[11px] font-bold text-white">{d.today ? t("Today") : `${t("Day")} ${d.day}`}</span>
            <span className="absolute end-2 top-2 z-10 rounded-full bg-sale px-2 py-0.5 text-[11px] font-bold text-white">−{d.deal.pct}%</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {d.deal.image ? <img src={d.deal.image} alt="" className={`w-full rounded-xl object-contain ${d.today ? "aspect-[4/3]" : "aspect-square"}`} /> : <div className="aspect-square rounded-xl bg-line" />}
            <p className="mt-2 truncate text-xs font-semibold uppercase text-muted">{d.deal.brand}</p>
            <p className="line-clamp-2 text-sm font-medium">{d.deal.name}</p>
            <p className="mt-1 text-sm"><b>{money(d.deal.price)}</b>{d.deal.was ? <s className="ms-2 text-muted">{money(d.deal.was)}</s> : null}</p>
          </Link>
        ) : (
          <div key={d.day} className="relative flex aspect-square flex-col items-center justify-center rounded-2xl bg-black p-3 text-center text-white">
            <div className="bf-anim text-4xl" style={{ animation: "bf-wiggle 2.4s ease-in-out infinite" }} aria-hidden>🎁</div>
            <p className="mt-2 text-xs font-bold uppercase tracking-wider">{t("Day")} {d.day}</p>
            {d.open ? <p className="text-xs opacity-80">{t("Opened")}</p> : <p className="text-xs opacity-80">{t("Opens")} {new Date(d.unlocksAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</p>}
          </div>
        ))}
      </div>
      {today?.deal && <p className="mt-3 text-sm text-muted">{t("Every Black Friday price stays on until the end; each day adds a new spotlight.")}</p>}
      {b.fx.stamps && (
        <div className="mt-4 rounded-2xl border border-dashed border-black p-4 text-sm">
          <b>{t("Black Friday stamp card")}</b> · {t("Order on any Black Friday day to collect that day's stamp")} (+{b.fx.stampPoints} {t("Club points")}). {t("Collect all")} {b.days} {t("for a bonus of")} {b.fx.stampBonus} {t("points")}.
          <div className="mt-2 flex gap-2">{b.doors.map((d) => <span key={d.day} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${d.open ? "border-black" : "border-line text-muted"}`}>{d.day}</span>)}</div>
        </div>
      )}
    </section>
  );
}

/** A burst of confetti from where the shopper clicked (Black Friday items only). */
export function bfConfetti(x: number, y: number) {
  if (typeof document === "undefined" || document.documentElement.dataset.bfConfetti !== "1") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  if (!document.getElementById("bf-kf")) { const st = document.createElement("style"); st.id = "bf-kf"; st.textContent = KEYFRAMES; document.head.appendChild(st); }
  const colors = ["#000", "#e11d48", "#f5c518", "#fff", "#f472b6"];
  for (let i = 0; i < 36; i++) {
    const el = document.createElement("span");
    const size = 5 + Math.random() * 6;
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size * 0.6}px;background:${colors[i % colors.length]};border-radius:1px;z-index:9999;pointer-events:none;--dx:${(Math.random() - 0.5) * 320}px;--r:${Math.random() * 720}deg;animation:bf-fall ${1.2 + Math.random()}s cubic-bezier(.2,.6,.4,1) forwards;box-shadow:0 0 0 .5px rgba(0,0,0,.15)`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }
}


/** Product page: Black Friday ribbon with the discount, a countdown to the end of the price, and today's-door / stamp hints. */
export function BfProductTag({ slug, price, was }: { slug: string; price: number; was?: number }) {
  const t = useT();
  const b = useBf();
  if (!b || b.phase !== "live") return null;
  const pct = was && was > price ? Math.round((1 - price / was) * 100) : 0;
  const isToday = b.deal?.slug === slug;
  return (
    <div className="mt-3 overflow-hidden rounded-2xl bg-black p-3 text-white">
      <style>{KEYFRAMES}</style>
      <div className="flex flex-wrap items-center gap-2">
        <span className="bf-anim rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest" style={{ background: "linear-gradient(100deg,#f43f5e,#fde68a,#d946ef,#f43f5e)", backgroundSize: "300% 100%", animation: "bf-shine 3s linear infinite", color: "#000" }}>{t("Black Friday")}{pct ? ` −${pct}%` : ""}</span>
        {isToday && <span className="bf-anim rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-black" style={{ animation: "bf-pulse 1.2s ease-in-out infinite" }}>🎁 {t("Today's door deal")}</span>}
        <span className="ms-auto text-xs">{t("Price ends in")} <b><Clock to={b.endsAt} /></b></span>
      </div>
      {b.fx.stamps && <p className="mt-2 text-xs text-white/75">✦ {t("Order today to collect your day")} {b.day} {t("stamp")} (+{b.fx.stampPoints} {t("Club points")}).</p>}
    </div>
  );
}

/** Cart: what Black Friday is saving the shopper, with the clock still running. */
export function BfCartBar({ saving }: { saving: number }) {
  const t = useT();
  const b = useBf();
  if (!b || b.phase !== "live") return null;
  return (
    <div className="relative overflow-hidden bg-black px-5 py-3 text-sm text-white">
      <style>{KEYFRAMES}</style>
      <div className="bf-anim pointer-events-none absolute inset-0 opacity-30" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)", backgroundSize: "200% 100%", animation: "bf-shine 3s linear infinite" }} />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <span>{saving > 0 ? <>🎉 {t("Black Friday is saving you")} <b>{money(saving)}</b></> : <>🎁 {t("Black Friday is on")}: <a href="/shop/?bf=1" className="underline">{t("see the deals")}</a></>}</span>
        <span className="text-xs">{t("Ends in")} <b><Clock to={b.endsAt} /></b></span>
      </div>
    </div>
  );
}
