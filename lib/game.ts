// Gamification engine: badges (points once each), review quest, referral race, refill streaks, daily check-in.
// Points go through addPoints with a "once" key, so nothing is ever paid twice.

import { db } from "@/lib/db";
import { BADGES, tierFor, type BadgeId } from "@/lib/growth";
import { addPoints, getGrowth, getMember, listReviews, orderIdsByPhone, yearSpend, type Member } from "@/lib/growth-store";
import { normPhone } from "@/lib/wa";

export type BadgeState = { id: BadgeId; name: string; text: string; icon: string; points: number; earned: boolean };
export type GameState = {
  badges: BadgeState[];
  quest: { done: number; target: number; points: number; complete: boolean } | null;
  race: { friends: number; steps: { friends: number; points: number; reached: boolean }[] } | null;
  tier: { name: string; next?: string; toNext: number; spend: number; progress: number };
  voucher: { points: number; target: number; value: number };
  newlyEarned: string[]; // badge names earned on this check (for a celebration)
};

/** Work out the member's badges and progress, paying points for anything newly earned. */
export async function syncGame(phone: string): Promise<GameState | null> {
  const g = await getGrowth();
  let m = await getMember(phone);
  if (!m || !g.club.enabled) return null;
  const game = g.game;
  const { getOrder } = await import("@/lib/orders");
  const ids = await orderIdsByPhone(m.phone, 50);
  const orders = (await Promise.all(ids.map(getOrder))).filter((o) => !!o);
  const live = orders.filter((o) => !["cancelled", "returned", "payment_failed"].includes(o!.status));
  const delivered = live.filter((o) => o!.status === "delivered");
  const reviews = (m.bonuses ?? []).filter((b) => b.startsWith("review:"));
  const orderSet = new Set(ids);
  const photo = reviews.length ? (await listReviews(500)).some((r) => r.photo && r.orderId && orderSet.has(r.orderId) && r.status === "approved") : false;
  const friends = (m.history ?? []).filter((h) => h.reason.startsWith("Friend's first order")).length;
  const scans = await (await import("@/lib/scans")).scansByPhone(m.phone).then((x) => x.length).catch(() => 0);
  const spend = yearSpend(m);
  const t = tierFor(g.club.tiers, spend);
  const tiers = [...g.club.tiers].sort((a, b) => a.minSpend - b.minSpend);
  const goldIdx = Math.max(0, tiers.findIndex((x) => /gold/i.test(x.name)));
  const tierIdx = tiers.findIndex((x) => x.name === t.tier.name);

  const has: Record<BadgeId, boolean> = {
    firstOrder: delivered.length > 0,
    scan: scans > 0,
    routine: live.some((o) => (o!.discounts ?? []).some((d) => d.name.startsWith("Routine set"))),
    review: reviews.length > 0,
    photoReview: photo,
    referral: friends > 0,
    subscriber: live.some((o) => o!.lines.some((l) => !!l.every)),
    gold: goldIdx > 0 && tierIdx >= goldIdx,
  };
  const newly: string[] = [];
  if (game.enabled && game.badges.enabled) {
    for (const b of BADGES) {
      const pts = game.badges.points[b.id] ?? 0;
      if (has[b.id] && !(m.bonuses ?? []).includes(`badge:${b.id}`)) {
        newly.push(b.name);
        m = (await addPoints(m.phone, Math.max(pts, 0) || 0, `Badge: ${b.name}`, `badge:${b.id}`)) ?? m;
        // A badge worth 0 points still has to be remembered as earned.
        if (!pts && m && !(m.bonuses ?? []).includes(`badge:${b.id}`)) await mark(m, `badge:${b.id}`);
      }
    }
  }
  // Review quest: review N products you bought.
  let quest: GameState["quest"] = null;
  if (game.enabled && game.quest.enabled) {
    const done = reviews.length;
    quest = { done: Math.min(done, game.quest.reviews), target: game.quest.reviews, points: game.quest.points, complete: done >= game.quest.reviews };
    if (quest.complete && m) m = (await addPoints(m.phone, game.quest.points, `Quest complete: ${game.quest.reviews} reviews`, "quest:reviews:1")) ?? m;
  }
  // Referral race: bonus points at 3, 5, 10 friends…
  let race: GameState["race"] = null;
  if (game.enabled && game.race.enabled && g.club.referral.enabled) {
    const steps = [...game.race.steps].sort((a, b) => a.friends - b.friends);
    race = { friends, steps: steps.map((s) => ({ ...s, reached: friends >= s.friends })) };
    for (const s of steps) if (friends >= s.friends && m) m = (await addPoints(m.phone, s.points, `Referral race: ${s.friends} friends`, `race:${s.friends}`)) ?? m;
  }
  const fresh = (await getMember(phone)) ?? m!;
  return {
    badges: BADGES.map((b) => ({ ...b, points: game.badges.points[b.id] ?? 0, earned: has[b.id] || (fresh.bonuses ?? []).includes(`badge:${b.id}`) })),
    quest,
    race,
    tier: { name: t.tier.name, next: t.next?.name, toNext: t.toNext, spend, progress: t.next ? Math.min(1, (spend - t.tier.minSpend) / Math.max(1, t.next.minSpend - t.tier.minSpend)) : 1 },
    voucher: { points: fresh.points, target: g.club.rewardPoints, value: g.club.rewardValue },
    newlyEarned: newly,
  };
}

async function mark(m: Member, key: string) {
  m.bonuses = [...(m.bonuses ?? []), key];
  await db.cmd(["HSET", "club:m", m.phone, JSON.stringify(m)]);
}

/** Refill streak: every Nth delivered subscription order earns bonus points. */
export async function refillStreak(sub: { id: string; customer: { phone: string } }, deliveredCount: number) {
  const g = await getGrowth();
  const s = g.game;
  if (!s.enabled || !s.streak.enabled || deliveredCount < s.streak.every || deliveredCount % s.streak.every !== 0) return;
  await addPoints(sub.customer.phone, s.streak.points, `Refill streak: ${deliveredCount} deliveries on time`, `streak:${sub.id}:${deliveredCount}`).catch(() => null);
}

/** App daily tip: one check-in per day (Beirut). A full streak of N days earns points, then starts again. */
export async function checkIn(phone: string) {
  const g = await getGrowth();
  const c = g.game.checkin;
  const p = normPhone(phone);
  if (!p || !g.game.enabled || !c.enabled) return null;
  const day = new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);
  const key = `checkin:${p}`;
  const raw = await db.cmd<string | null>(["GET", key]);
  const st = raw ? (JSON.parse(raw) as { last: string; streak: number; rounds: number }) : { last: "", streak: 0, rounds: 0 };
  let earned = 0;
  if (st.last !== day) {
    const yesterday = new Date(Date.parse(`${day}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);
    st.streak = st.last === yesterday ? st.streak + 1 : 1;
    st.last = day;
    if (st.streak >= c.days) {
      const m = await getMember(p);
      if (m) { st.rounds += 1; earned = c.points; await addPoints(p, c.points, `${c.days}-day tip streak`, `checkin:${st.rounds}:${day}`); }
      st.streak = 0;
    }
    await db.cmd(["SET", key, JSON.stringify(st), "EX", String(60 * 864e2)]);
  }
  return { streak: st.streak, days: c.days, points: c.points, earned, today: day };
}
