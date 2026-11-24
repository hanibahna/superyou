"use client";

import { useEffect, useRef } from "react";
import { money } from "@/lib/format";
import { useGrowth, useSettings, useT } from "@/lib/site-context";
import { useShop } from "@/lib/store";
import { celebrate } from "./Celebrate";

type Step = { at: number; label: string; icon: string };

/** One bar with milestones: free delivery, gifts and samples, double Club points. Celebrates each step reached. */
export function RewardLadder() {
  const tx = useT();
  const { subtotal, quote } = useShop();
  const { delivery } = useSettings();
  const g = useGrowth();
  const club = g.club;
  const steps: Step[] = [];
  if (delivery.freeThreshold > 0) steps.push({ at: delivery.freeThreshold, label: tx("Free delivery"), icon: "🚚" });
  for (const t of quote?.gifts ?? []) if (t.showProgress || t.unlocked) steps.push({ at: +(subtotal + (t.unlocked ? 0 : t.remaining)).toFixed(2), label: t.name, icon: "🎁" });
  if (quote?.doublePointsAt) steps.push({ at: quote.doublePointsAt, label: tx("Double Club points"), icon: "✦" });
  steps.sort((a, b) => a.at - b.at);
  const max = Math.max(...steps.map((s) => s.at), 1);
  const next = steps.find((s) => subtotal < s.at);
  const reached = steps.filter((s) => subtotal >= s.at).length;
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (g.game?.celebrate !== false && prev.current !== null && reached > prev.current) celebrate({ y: 140, x: window.innerWidth - 200, count: 60 });
    prev.current = reached;
  }, [reached, g.game?.celebrate]);
  if (!steps.length) return null;
  const points = club?.enabled ? Math.floor(subtotal * (club.pointsPerDollar || 0) * (quote?.doublePointsAt && subtotal >= quote.doublePointsAt ? 2 : 1)) : 0;
  const r = quote?.routine;
  return (
    <div className="border-b border-line px-5 py-3">
      <p className="text-sm">
        {next ? <>{tx("Add")} <b>{money(next.at - subtotal)}</b> {tx("for")} <b>{next.label}</b> {next.icon}</> : <b className="text-brand-600">{tx("Every reward unlocked")} 🎉</b>}
        {(() => {
          // Both goals in words: free delivery and the next free gift, when neither is the line above.
          const ship = steps.find((x) => x.icon === "🚚" && subtotal < x.at);
          const gift = steps.find((x) => x.icon === "🎁" && subtotal < x.at);
          const other = next === ship ? gift : next === gift ? ship : undefined;
          return other ? <span className="mt-0.5 block text-xs text-muted">{tx("and")} <b>{money(other.at - subtotal)}</b> {tx("for")} {other.label} {other.icon}</span> : null;
        })()}
      </p>
      <div className="relative mt-3 h-2 rounded-full bg-line">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-500 to-sale transition-all duration-700" style={{ width: `${Math.min(100, (subtotal / max) * 100)}%` }} />
        {steps.map((s) => (
          <span key={s.label + s.at} title={`${s.label} at ${money(s.at)}`} className={`absolute top-1/2 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-[11px] transition ${subtotal >= s.at ? "border-brand-500 bg-brand-500 text-white scale-110" : "border-line bg-white"}`} style={{ left: `${Math.min(97, Math.max(3, (s.at / max) * 100))}%` }}>{s.icon}</span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {steps.map((s) => <span key={s.label} className={subtotal >= s.at ? "font-semibold text-ink" : ""}>{subtotal >= s.at ? "✓" : money(s.at)} {s.label}</span>)}
      </div>
      {points > 0 && <p className="mt-2 text-xs text-muted">✦ {tx("This order earns")} <b className="text-ink">{points} {club.name || "Club"} {tx("points")}</b></p>}
      {r && r.need > 1 && r.have > 0 && (r.have >= r.need ? (
        <p className="mt-2 text-xs font-semibold text-brand-700">🧴 {tx("Routine set")}: {r.have} {tx("steps")} · {r.percent}% {tx("off applied")}</p>
      ) : (
        <div className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs">
          <p><b>{tx("Your routine")}: {r.have} {tx("of")} {r.need} {tx("steps")}</b> · {tx("add")} {r.need - r.have} {tx("more for")} {r.percent}% {tx("off the set")}</p>
          <div className="mt-1.5 flex gap-1">{Array.from({ length: r.need }, (_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < r.have ? "bg-brand-500" : "bg-white"}`} />)}</div>
          {r.all.length > 0 && <p className="mt-1.5 text-muted">{tx("Missing")}: {r.all.filter((x) => !r.steps.includes(x)).slice(0, 3).join(", ")}</p>}
        </div>
      ))}
    </div>
  );
}
