"use client";

import { useEffect } from "react";
import { celebrate } from "./Celebrate";
import { money } from "@/lib/format";

export type GameState = {
  badges: { id: string; name: string; text: string; icon: string; points: number; earned: boolean }[];
  quest: { done: number; target: number; points: number; complete: boolean } | null;
  race: { friends: number; steps: { friends: number; points: number; reached: boolean }[] } | null;
  tier: { name: string; next?: string; toNext: number; spend: number; progress: number };
  voucher: { points: number; target: number; value: number };
  newlyEarned: string[];
};

const ICONS: Record<string, string> = { bag: "🛍️", scan: "🪞", layers: "🧴", star: "⭐", camera: "📸", gift: "🎁", repeat: "🔁", crown: "👑" };

/** Club progress ring, badges, review quest and referral race (Account page). */
export function GamePanel({ game }: { game: GameState }) {
  useEffect(() => { if (game.newlyEarned.length) setTimeout(() => celebrate({ count: 80 }), 400); }, [game.newlyEarned.length]);
  const earned = game.badges.filter((b) => b.earned).length;
  const pct = Math.min(1, game.voucher.points / Math.max(1, game.voucher.target));
  return (
    <section className="mt-6 space-y-5">
      {game.newlyEarned.length > 0 && (
        <div className="rounded-2xl bg-ink p-4 text-center text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-100">New badge{game.newlyEarned.length > 1 ? "s" : ""}</p>
          <p className="mt-1 text-lg font-semibold">{game.newlyEarned.join(" · ")}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Ring value={pct} label={`${game.voucher.points} / ${game.voucher.target}`} title="Next voucher" text={`${money(game.voucher.value)} when you reach ${game.voucher.target} points`} />
        <Ring value={game.tier.progress} label={game.tier.name} title={game.tier.next ? `Next: ${game.tier.next}` : "Top tier"} text={game.tier.next ? `Spend ${money(game.tier.toNext)} more this year` : "You're at the top. Thank you!"} />
      </div>

      <div className="rounded-2xl border border-line p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">My badges</h2>
          <span className="text-sm text-muted">{earned} of {game.badges.length}</span>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {game.badges.map((b) => (
            <div key={b.id} title={`${b.name}: ${b.text}${b.points ? ` (+${b.points} points)` : ""}`} className="text-center">
              <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl transition ${b.earned ? "bg-brand-50 ring-2 ring-brand-500" : "bg-line/60 opacity-40 grayscale"}`}>{ICONS[b.icon] ?? "✦"}</div>
              <p className="mt-1.5 text-[11px] font-semibold leading-tight">{b.name}</p>
              {!b.earned && b.points > 0 && <p className="text-[10px] text-muted">+{b.points}</p>}
            </div>
          ))}
        </div>
      </div>

      {game.quest && (
        <div className="rounded-2xl border border-line p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Quest</p>
          <h2 className="mt-1 text-lg font-semibold">Review {game.quest.target} products you bought</h2>
          <Bar value={game.quest.done / game.quest.target} />
          <p className="mt-2 text-sm text-muted">{game.quest.complete ? `Done! +${game.quest.points} points added.` : `${game.quest.done} of ${game.quest.target} · +${game.quest.points} points when complete. The review link comes on WhatsApp after delivery.`}</p>
        </div>
      )}

      {game.race && (
        <div className="rounded-2xl border border-line p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Referral race</p>
          <h2 className="mt-1 text-lg font-semibold">{game.race.friends} friend{game.race.friends === 1 ? "" : "s"} ordered with your link</h2>
          <ol className="mt-4 flex items-center gap-2">
            {game.race.steps.map((s) => (
              <li key={s.friends} className={`flex-1 rounded-xl p-3 text-center text-sm ${s.reached ? "bg-brand-500 text-white" : "bg-line/50"}`}>
                <b className="block text-lg">{s.friends}</b>friends · +{s.points}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function Ring({ value, label, title, text }: { value: number; label: string; title: string; text: string }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-brand-50 p-4">
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden className="shrink-0 -rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-white" />
        <circle cx="42" cy="42" r={r} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} className="text-brand-500 transition-[stroke-dashoffset] duration-1000" />
      </svg>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-brand-600">{title}</p>
        <p className="text-xl font-semibold">{label}</p>
        <p className="text-xs text-muted">{text}</p>
      </div>
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sale transition-all duration-700" style={{ width: `${Math.min(100, value * 100)}%` }} /></div>;
}
