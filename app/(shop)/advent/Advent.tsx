"use client";

import { useT } from "@/lib/site-context";

import Link from "next/link";
import { useState } from "react";

type Door = { day: number; title: string; text: string; code: string; href: string; image: string; open: boolean };

export function Advent({ title, intro, doors, today, year }: { title: string; intro: string; doors: Door[]; today: number; year: number }) {
  const tx = useT();
  const [shown, setShown] = useState<Door | null>(null);
  return (
    <div className="bg-ink pb-16 text-white">
      <div className="container-x py-12 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-white/60">1–24 December {year}</p>
        <h1 className="mt-3 text-4xl font-black md:text-6xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-white/70">{intro}</p>
        {today === 0 && <p className="mt-4 text-sm text-white/60">{tx("The first door opens on 1 December. Sign up to be reminded on WhatsApp.")}</p>}
      </div>
      <div className="container-x grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {doors.map((d) => (
          <button
            key={d.day}
            disabled={!d.open}
            onClick={() => setShown(d)}
            className={`relative aspect-square rounded-xl border text-3xl font-black transition ${d.open ? (d.day === today ? "border-white bg-sale text-white" : "border-white/30 bg-white/10 hover:bg-white/20") : "cursor-not-allowed border-white/10 text-white/25"}`}
          >
            {d.day}
            <span className="absolute bottom-2 left-0 right-0 text-[10px] font-semibold uppercase tracking-widest">{d.open ? (d.day === today ? tx("Today") : tx("Open")) : tx("Locked")}</span>
          </button>
        ))}
      </div>
      {shown && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShown(null)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white text-ink">
            {shown.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown.image} alt="" className="aspect-video w-full object-cover" />
            )}
            <div className="p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-sale">Day {shown.day}</p>
              <h2 className="mt-1 text-2xl font-bold">{shown.title}</h2>
              {shown.text && <p className="mt-2 text-muted">{shown.text}</p>}
              {shown.code && <p className="mt-4 rounded-lg border-2 border-dashed border-ink py-3 font-mono text-xl font-bold tracking-widest">{shown.code}</p>}
              {shown.href && <Link href={shown.href} className="mt-5 block rounded-full bg-ink py-3 font-semibold text-white">Shop today's deal</Link>}
              <button onClick={() => setShown(null)} className="mt-3 text-sm text-muted underline">{tx("Close")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
