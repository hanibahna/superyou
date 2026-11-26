import { fullName } from "@/lib/data/catalog";
import "server-only";

// Storage for the growth features: personal voucher codes, reviews, club members,
// reorder / review reminders. See lib/growth.ts for the settings.

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/site-url";
import { tierFor, withGrowthDefaults, type Growth } from "@/lib/growth";
import type { Discount } from "@/lib/site";
import { readDoc, writeDoc } from "@/lib/site-store";
import { normPhone } from "@/lib/wa";

export const getGrowth = () => readDoc<Growth>("growth", withGrowthDefaults(null), (v) => withGrowthDefaults(v));
export const saveGrowth = (v: Growth) => writeDoc("growth", v);

const site = () => siteUrl();

// ── Personal voucher codes (welcome, wheel, cart exit, club reward, birthday) ──

export type Voucher = {
  code: string;
  kind: "welcome" | "cart" | "club" | "birthday" | "referral";
  percent: number; // either a percentage…
  amount: number; // …or a fixed amount off the order
  minSubtotal: number;
  expires: string; // ISO
  owner: string; // email or phone
  used: boolean;
  createdAt: string;
};

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const rand = (n: number) => Array.from(randomBytes(n), (b) => ALPHA[b % ALPHA.length]).join("");

export async function createVoucher(v: Omit<Voucher, "code" | "used" | "createdAt"> & { prefix: string }) {
  const { prefix, ...rest } = v;
  const voucher: Voucher = { ...rest, code: `${prefix}-${rand(5)}`, used: false, createdAt: new Date().toISOString() };
  await db.pipeline([
    ["SET", `vc:${voucher.code}`, JSON.stringify(voucher)],
    ["ZADD", "vouchers", Date.now(), voucher.code],
  ]);
  return voucher;
}

export async function getVoucher(code: string): Promise<Voucher | null> {
  const raw = await db.cmd<string | null>(["GET", `vc:${code.trim().toUpperCase()}`]);
  return raw ? (JSON.parse(raw) as Voucher) : null;
}

export async function useVoucher(code: string) {
  const v = await getVoucher(code);
  if (!v) return;
  v.used = true;
  await db.cmd(["SET", `vc:${v.code}`, JSON.stringify(v)]);
}

export async function listVouchers(limit = 300): Promise<Voucher[]> {
  const codes = await db.cmd<string[]>(["ZREVRANGE", "vouchers", 0, limit - 1]);
  const raws = codes.length ? await db.pipeline(codes.map((c) => ["GET", `vc:${c}`])) : [];
  return raws.filter(Boolean).map((r) => JSON.parse(r as string) as Voucher);
}

/** A personal code as a one-off discount rule the cart maths understands. */
export function voucherRule(v: Voucher): Discount | { error: string } {
  if (v.used) return { error: "This code has already been used" };
  if (Date.parse(v.expires) < Date.now()) return { error: "This code has expired" };
  return {
    id: `vc-${v.code}`, name: v.kind === "club" ? "Club reward" : v.kind === "birthday" ? "Birthday gift" : "Welcome offer",
    enabled: true, type: v.percent > 0 ? "percent" : "fixed", value: v.percent > 0 ? v.percent : v.amount,
    scope: { kind: "all", values: [] }, exclude: { kind: "all", values: [] }, code: v.code, minSubtotal: v.minSubtotal,
    startsAt: "", endsAt: v.expires, stack: v.kind !== "welcome", usageLimit: 1, used: 0,
  };
}

/** Sign-up from the pop-up: one welcome code per email / phone. */
export async function welcomeCode(owner: string, g: Growth, percent: number) {
  const id = owner.toLowerCase();
  const existing = await db.cmd<string | null>(["GET", `vc:owner:${id}`]);
  if (existing) {
    const v = await getVoucher(existing);
    if (v && !v.used) return { voucher: v, isNew: false };
    if (v?.used) return { voucher: null, isNew: false };
  }
  const voucher = await createVoucher({
    prefix: "HELLO", kind: "welcome", percent, amount: 0, minSubtotal: g.popup.minSubtotal,
    expires: new Date(Date.now() + g.popup.validDays * 864e5).toISOString(), owner: id,
  });
  await db.cmd(["SET", `vc:owner:${id}`, voucher.code]);
  return { voucher, isNew: true };
}

/** Spin-to-win: the server picks the slice, weighted. */
export function spin(g: Growth) {
  const total = g.popup.wheel.reduce((s, w) => s + w.weight, 0) || 1;
  let r = (randomBytes(4).readUInt32BE() / 0xffffffff) * total;
  for (let i = 0; i < g.popup.wheel.length; i++) {
    r -= g.popup.wheel[i].weight;
    if (r <= 0) return { index: i, slice: g.popup.wheel[i] };
  }
  return { index: 0, slice: g.popup.wheel[0] };
}

// ── Reviews ──

export type Review = {
  id: string;
  slug: string; // product page
  product: string;
  rating: number; // 1–5
  title: string;
  body: string;
  name: string;
  skinType?: string;
  photo?: string;
  verified: boolean; // bought it (came from an order link)
  orderId?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reply?: string; // pharmacist answer
};
export type RatingSummary = { slug: string; count: number; avg: number };

export async function addReview(r: Omit<Review, "id" | "createdAt" | "status">, autoApprove: boolean) {
  const review: Review = { ...r, id: rand(10), createdAt: new Date().toISOString(), status: autoApprove ? "approved" : "pending" };
  await db.pipeline([
    ["HSET", `rv:${review.slug}`, review.id, JSON.stringify(review)],
    ["ZADD", "rv:all", Date.now(), `${review.slug}|${review.id}`],
  ]);
  if (review.status === "approved") (await refreshSummary(review.slug), await awardReview(review).catch(() => {}));
  return review;
}

export async function productReviews(slug: string, all = false): Promise<Review[]> {
  const vals = await db.cmd<string[]>(["HVALS", `rv:${slug}`]);
  return vals.map((v) => JSON.parse(v) as Review).filter((r) => all || r.status === "approved").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listReviews(limit = 500): Promise<Review[]> {
  const keys = await db.cmd<string[]>(["ZREVRANGE", "rv:all", 0, limit - 1]);
  const raws = keys.length ? await db.pipeline(keys.map((k) => { const [slug, id] = k.split("|"); return ["HGET", `rv:${slug}`, id]; })) : [];
  return raws.filter(Boolean).map((r) => JSON.parse(r as string) as Review);
}

export async function updateReview(slug: string, id: string, patch: Partial<Pick<Review, "status" | "reply">>) {
  const raw = await db.cmd<string | null>(["HGET", `rv:${slug}`, id]);
  if (!raw) return null;
  const r = { ...(JSON.parse(raw) as Review), ...patch };
  await db.cmd(["HSET", `rv:${slug}`, id, JSON.stringify(r)]);
  await refreshSummary(slug);
  if (r.status === "approved") await awardReview(r).catch(() => {});
  return r;
}

export async function deleteReview(slug: string, id: string) {
  await db.pipeline([["HDEL", `rv:${slug}`, id], ["ZREM", "rv:all", `${slug}|${id}`]]);
  await refreshSummary(slug);
}

async function refreshSummary(slug: string) {
  const list = await productReviews(slug);
  if (!list.length) await db.cmd(["HDEL", "rv:sum", slug]);
  else await db.cmd(["HSET", "rv:sum", slug, JSON.stringify({ slug, count: list.length, avg: +(list.reduce((s, r) => s + r.rating, 0) / list.length).toFixed(2) })]);
  await db.cmd(["INCR", "rv:ver"]);
}

const gs = globalThis as unknown as { __rv?: { ver: string; map: Map<string, RatingSummary> } };
/** Star ratings for every product page (cached until a review changes). */
export async function ratingMap() {
  const ver = String((await db.cmd<string | null>(["GET", "rv:ver"]).catch(() => null)) ?? "0");
  if (gs.__rv?.ver === ver) return gs.__rv.map;
  const vals = await db.cmd<string[]>(["HVALS", "rv:sum"]).catch(() => [] as string[]);
  const map = new Map(vals.map((v) => { const s = JSON.parse(v) as RatingSummary; return [s.slug, s]; }));
  gs.__rv = { ver, map };
  return map;
}

// ── SuperYou Club ──

export type Member = {
  phone: string;
  name: string;
  email?: string;
  points: number; // balance towards the next voucher
  lifetimePoints: number;
  purchases: { at: string; amount: number; orderId: string }[]; // last 12 months used for the tier
  birthday?: string; // MM-DD
  lastBirthdayYear?: number;
  rewards: string[]; // voucher codes issued
  joinedAt: string;
  history?: { at: string; points: number; reason: string }[]; // newest last
  ref?: string; // personal referral code, e.g. REF-RANA7
  referredBy?: string; // referral code used on their first order
  bonuses?: string[]; // one-off bonuses already given ("join", "first-order", "review:<id>"…)
  lastActivity?: string;
};

const hist = (m: Member, points: number, reason: string) => {
  m.history = [...(m.history ?? []), { at: new Date().toISOString(), points, reason }].slice(-200);
  m.lastActivity = new Date().toISOString();
};

/** Give points (or take them away with a negative number). One-off bonuses pass a unique `once` key. */
export async function addPoints(phone: string, points: number, reason: string, once?: string) {
  const m = await getMember(phone);
  if (!m || !points) return m;
  if (once && m.bonuses?.includes(once)) return m;
  if (once) m.bonuses = [...(m.bonuses ?? []), once];
  m.points = Math.max(0, m.points + points);
  if (points > 0) m.lifetimePoints += points;
  hist(m, points, reason);
  await payRewards(m, m.name.split(" ")[0] || "there");
  await saveMember(m);
  return m;
}

/** Turn full blocks of points into voucher codes (sent on WhatsApp). */
async function payRewards(m: Member, firstName: string) {
  const g = await getGrowth();
  if (!g.club.enabled || g.club.rewardValue <= 0) return;
  const wa = await import("@/lib/whatsapp");
  while (m.points >= g.club.rewardPoints) {
    m.points -= g.club.rewardPoints;
    const v = await createVoucher({ prefix: "CLUB", kind: "club", percent: 0, amount: g.club.rewardValue, minSubtotal: 0, expires: new Date(Date.now() + 180 * 864e5).toISOString(), owner: m.phone });
    m.rewards.push(v.code);
    hist(m, -g.club.rewardPoints, `Voucher ${v.code} ($${g.club.rewardValue})`);
    await wa.trigger("clubReward", m.phone, { first_name: firstName, code: v.code, value: `$${g.club.rewardValue}`, points: String(g.club.rewardPoints) });
  }
}

/** Points expire after N months without any order. Checked whenever the member is read. */
function expire(m: Member, months: number) {
  if (!months || !m.points) return false;
  const last = Date.parse(m.lastActivity ?? m.joinedAt);
  if (Date.now() - last < months * 30.5 * 864e5) return false;
  hist(m, -m.points, `Expired after ${months} months without an order`);
  m.points = 0;
  return true;
}

export async function memberByRef(code: string): Promise<Member | null> {
  const phone = await db.cmd<string | null>(["GET", `club:ref:${code.trim().toUpperCase()}`]);
  return phone ? getMember(phone) : null;
}

export async function getMember(phone: string): Promise<Member | null> {
  const p = normPhone(phone);
  if (!p) return null;
  const raw = await db.cmd<string | null>(["HGET", "club:m", p]);
  if (!raw) return null;
  const m = JSON.parse(raw) as Member;
  const g = await getGrowth();
  if (expire(m, g.club.expiryMonths)) await saveMember(m);
  return m;
}
const saveMember = (m: Member) => db.cmd(["HSET", "club:m", m.phone, JSON.stringify(m)]);

export async function joinClub(input: { phone: string; name: string; email?: string; birthday?: string }) {
  const phone = normPhone(input.phone);
  if (!phone) return null;
  const existing = await getMember(phone);
  const m: Member = existing ?? { phone, name: input.name, points: 0, lifetimePoints: 0, purchases: [], rewards: [], joinedAt: new Date().toISOString(), history: [] };
  m.name = input.name || m.name;
  if (!m.ref) {
    const base = (m.name.split(" ")[0] || "SY").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "SY";
    m.ref = `REF-${base}${rand(3)}`;
    await db.cmd(["SET", `club:ref:${m.ref}`, phone]);
  }
  if (!existing) {
    const g = await getGrowth();
    if (g.club.bonus.join > 0) (m.points += g.club.bonus.join, (m.lifetimePoints += g.club.bonus.join), (m.bonuses = ["join"]), hist(m, g.club.bonus.join, "Welcome bonus"));
    else hist(m, 0, "Joined");
  }
  if (input.email) m.email = input.email;
  if (input.birthday && /^\d{2}-\d{2}$/.test(input.birthday)) m.birthday = input.birthday;
  await saveMember(m);
  return m;
}

export const yearSpend = (m: Member) => +m.purchases.filter((p) => Date.parse(p.at) > Date.now() - 365 * 864e5).reduce((s, p) => s + p.amount, 0).toFixed(2);

/** "Delete my account": removes the Club membership, points and referral code. */
export async function deleteMember(phone: string) {
  const m = await getMember(phone);
  if (!m) return false;
  await db.cmd(["HDEL", "club:m", m.phone]);
  if (m.ref) await db.cmd(["DEL", `club:ref:${m.ref}`]).catch(() => {});
  return true;
}

export async function allMembers(): Promise<Member[]> {
  const out: Member[] = [];
  let cursor = "0";
  do {
    const [next, flat] = await db.cmd<[string, string[]]>(["HSCAN", "club:m", cursor, "COUNT", 1000]);
    for (let i = 1; i < flat.length; i += 2) out.push(JSON.parse(flat[i]) as Member);
    cursor = next;
  } while (cursor !== "0");
  return out;
}

/** Points for a delivered order; turns full point blocks into voucher codes sent on WhatsApp. */
export async function awardPoints(order: { id: string; total: number; delivery: number; channel?: "app"; customer: { phone: string; firstName: string; lastName: string; email?: string } }) {
  const g = await getGrowth();
  if (!g.club.enabled) return;
  const m = await getMember(order.customer.phone);
  if (!m || m.purchases.some((p) => p.orderId === order.id)) return; // only members, once per order
  const spend = Math.max(0, order.total - order.delivery);
  const { tier } = tierFor(g.club.tiers, yearSpend(m));
  // Reward ladder: orders at or above the double-points line earn twice the points.
  const double = g.game?.enabled && g.game.ladder.enabled && g.game.ladder.doublePointsAt > 0 && spend >= g.game.ladder.doublePointsAt;
  // App orders earn double points (Admin › Growth › Mobile apps); never more than ×2 with the ladder.
  const appDouble = order.channel === "app" && g.apps.doublePoints;
  const pts = Math.floor(spend * g.club.pointsPerDollar * tier.multiplier * (double || appDouble ? 2 : 1));
  const first = m.purchases.length === 0;
  m.purchases = [...m.purchases.filter((p) => Date.parse(p.at) > Date.now() - 400 * 864e5), { at: new Date().toISOString(), amount: spend, orderId: order.id }];
  m.points += pts;
  m.lifetimePoints += pts;
  hist(m, pts, `Order ${order.id} ($${spend.toFixed(2)}${tier.multiplier !== 1 ? ` × ${tier.multiplier} ${tier.name}` : ""})`);
  if (first && g.club.bonus.firstOrder > 0 && !m.bonuses?.includes("first-order")) {
    m.points += g.club.bonus.firstOrder;
    m.lifetimePoints += g.club.bonus.firstOrder;
    m.bonuses = [...(m.bonuses ?? []), "first-order"];
    hist(m, g.club.bonus.firstOrder, "First order bonus");
  }
  await payRewards(m, order.customer.firstName);
  await saveMember(m);
}

/** A referred friend's first order was delivered: "Give $5, get $5" — a $ code (sent on WhatsApp)
 *  and/or points for the member who invited them. Once per order. */
export async function awardReferral(order: { id: string; referral?: string; customer: { phone: string; firstName?: string } }) {
  const g = await getGrowth();
  const r = g.club.referral;
  if (!order.referral || !r.enabled) return;
  const referrer = await memberByRef(order.referral);
  if (!referrer || normPhone(referrer.phone) === normPhone(order.customer.phone)) return;
  if (r.referrerPoints > 0) await addPoints(referrer.phone, r.referrerPoints, `Friend's first order (${order.id})`, `ref:${order.id}`);
  if ((r.referrerAmount ?? 0) > 0) {
    const once = await db.cmd<string | null>(["SET", `ref:paid:${order.id}`, "1", "NX", "EX", 400 * 86400]);
    if (once !== "OK") return;
    const v = await createVoucher({ prefix: "FRIEND", kind: "referral", percent: 0, amount: r.referrerAmount, minSubtotal: 0, expires: new Date(Date.now() + 180 * 864e5).toISOString(), owner: referrer.phone });
    const m = await getMember(referrer.phone);
    if (m) { m.rewards.push(v.code); hist(m, 0, `Friend's first order: $${r.referrerAmount} code ${v.code}`); await saveMember(m); }
    const wa = await import("@/lib/whatsapp");
    await wa.trigger("clubReward", referrer.phone, { first_name: (m?.name ?? "").split(" ")[0], code: v.code, value: `$${r.referrerAmount}`, points: "0" }).catch(() => false);
  }
}

/** Points for an approved review that came from an order link. */
export async function awardReview(r: { id: string; photo?: string; orderId?: string; verified: boolean }) {
  if (!r.verified || !r.orderId) return;
  const g = await getGrowth();
  const pts = r.photo ? g.club.bonus.photoReview : g.club.bonus.review;
  if (!g.club.enabled || pts <= 0) return;
  const { getOrder } = await import("@/lib/orders");
  const o = await getOrder(r.orderId);
  if (o) await addPoints(o.customer.phone, pts, "Thank you for your review", `review:${r.id}`);
}

// ── Reminders: review requests and restock reminders (sent by the daily cron) ──

type Reminder = { kind: "review" | "reorder"; phone: string; firstName: string; orderId: string; token?: string; slug?: string; product?: string };

export async function scheduleAfterDelivery(order: { id: string; accessToken: string; customer: { phone: string; firstName: string }; lines: { productId: string; name: string; gift?: boolean; qty?: number; every?: number }[] }) {
  const g = await getGrowth();
  const { getIndex } = await import("@/lib/catalog");
  const idx = await getIndex();
  const cmds: (string | number)[][] = [];
  const base = { phone: order.customer.phone, firstName: order.customer.firstName, orderId: order.id };
  if (g.reviews.enabled && g.reviews.askAfterDelivery)
    cmds.push(["ZADD", "remind", Date.now() + 864e5, JSON.stringify({ ...base, kind: "review", token: order.accessToken } satisfies Reminder)]);
  // Restock reminder a few days before the product runs out: from how long it lasts (AI estimate,
  // times the quantity bought), else the days set per category. Not for subscribed lines.
  const lives = g.reorder.enabled ? await (await import("@/lib/lifespan")).getLives(order.lines.map((l) => idx.byId.get(l.productId)?.slug ?? "")) : new Map();
  if (g.reorder.enabled)
    for (const l of order.lines.filter((x) => !x.gift && !x.every)) {
      const p = idx.byId.get(l.productId);
      if (!p) continue;
      const life = lives.get(p.slug);
      if (life && !life.every) continue; // lasts too long or not a repeat buy (perfume, device…)
      const days = life ? Math.max(7, Math.min(270, life.days * (l.qty ?? 1) - 5)) : g.reorder.days.find((d) => d.category === p.category)?.days ?? g.reorder.defaultDays;
      cmds.push(["ZADD", "remind", Date.now() + days * 864e5, JSON.stringify({ ...base, kind: "reorder", slug: p.slug, product: `${fullName(p.brand, p.name)}` } satisfies Reminder)]);
    }
  if (cmds.length) await db.pipeline(cmds);
}

/** Send what is due now. Returns how many were sent. */
export async function sendDueReminders(limit = 200) {
  const due = await db.cmd<string[]>(["ZRANGEBYSCORE", "remind", "-inf", Date.now(), "LIMIT", 0, limit]);
  if (!due.length) return 0;
  const wa = await import("@/lib/whatsapp");
  for (const raw of due) {
    const r = JSON.parse(raw) as Reminder;
    if (r.kind === "review") await wa.trigger("reviewRequest", r.phone, { first_name: r.firstName, order_id: r.orderId, link: `${site()}/review/?o=${r.orderId}&t=${r.token}` });
    else await wa.trigger("reorderReminder", r.phone, { first_name: r.firstName, product: r.product ?? "your favourites", link: `${site()}/products/${r.slug}/?reorder=1` });
  }
  await db.cmd(["ZREM", "remind", ...due]);
  return due.length;
}

/** Birthday codes for members whose birthday is today (Beirut time). */
export async function sendBirthdays() {
  const g = await getGrowth();
  if (!g.club.enabled || g.club.birthdayPercent <= 0) return 0;
  const now = new Date(Date.now() + 2 * 3600e3);
  const today = `${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const wa = await import("@/lib/whatsapp");
  let n = 0;
  for (const m of await allMembers()) {
    if (m.birthday !== today || m.lastBirthdayYear === now.getUTCFullYear()) continue;
    const v = await createVoucher({ prefix: "BDAY", kind: "birthday", percent: g.club.birthdayPercent, amount: 0, minSubtotal: 0, expires: new Date(Date.now() + 7 * 864e5).toISOString(), owner: m.phone });
    m.lastBirthdayYear = now.getUTCFullYear();
    m.rewards.push(v.code);
    await saveMember(m);
    await wa.trigger("birthday", m.phone, { first_name: m.name.split(" ")[0] || "there", code: v.code, percent: String(g.club.birthdayPercent) });
    n++;
  }
  return n;
}

// ── Orders by phone (account page, "buy again") ──

export const indexOrderByPhone = (phone: string, orderId: string) => db.cmd(["ZADD", `orders:by:${normPhone(phone)}`, Date.now(), orderId]);
export const orderIdsByPhone = (phone: string, limit = 20) => db.cmd<string[]>(["ZREVRANGE", `orders:by:${normPhone(phone)}`, 0, limit - 1]);
