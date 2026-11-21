import "server-only";

// Gift cards: issued in Admin → Gift cards, used at checkout like money (in the discount-code box).
// The balance is kept as cents in its own key so two orders can't spend the same dollars.

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export type GiftCard = {
  code: string; // GC-XXXX-XXXX
  initial: number;
  createdAt: string;
  expiresAt?: string;
  recipient: string;
  phone: string;
  note: string;
  disabled: boolean;
  by: string;
  history: { at: string; amount: number; orderId?: string; note?: string }[]; // negative = spent
};

export const isGiftCode = (c?: string) => !!c && /^GC-/i.test(c.trim());
const norm = (c: string) => c.trim().toUpperCase();
const cents = (n: number) => Math.round(n * 100);

function newCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = randomBytes(8);
  const s = [...b].map((x) => A[x % A.length]).join("");
  return `GC-${s.slice(0, 4)}-${s.slice(4)}`;
}

export async function issueGiftCard(input: { amount: number; recipient?: string; phone?: string; note?: string; validMonths: number; by: string }) {
  const code = newCode();
  const now = new Date();
  const gc: GiftCard = {
    code, initial: +input.amount.toFixed(2), createdAt: now.toISOString(),
    expiresAt: input.validMonths ? new Date(now.getTime() + input.validMonths * 30.44 * 864e5).toISOString() : undefined,
    recipient: input.recipient ?? "", phone: input.phone ?? "", note: input.note ?? "", disabled: false, by: input.by,
    history: [{ at: now.toISOString(), amount: +input.amount.toFixed(2), note: "Issued" }],
  };
  await db.pipeline([
    ["SET", `gc:${code}`, JSON.stringify(gc)],
    ["SET", `gc:bal:${code}`, cents(input.amount)],
    ["ZADD", "giftcards", now.getTime(), code],
  ]);
  return gc;
}

export async function getGiftCard(code: string): Promise<(GiftCard & { balance: number }) | null> {
  const c = norm(code);
  const [raw, bal] = await db.pipeline([["GET", `gc:${c}`], ["GET", `gc:bal:${c}`]]);
  if (!raw) return null;
  return { ...(JSON.parse(raw as string) as GiftCard), balance: Number(bal ?? 0) / 100 };
}

export async function listGiftCards(limit = 500) {
  const codes = await db.cmd<string[]>(["ZREVRANGE", "giftcards", 0, limit - 1]);
  const out = await Promise.all(codes.map(getGiftCard));
  return out.filter((x): x is NonNullable<typeof x> => !!x);
}

/** Why this card can't be used right now (or null). */
export function giftCardProblem(gc: (GiftCard & { balance: number }) | null): string | null {
  if (!gc) return "That gift card code doesn't exist";
  if (gc.disabled) return "This gift card has been cancelled";
  if (gc.expiresAt && Date.parse(gc.expiresAt) < Date.now()) return "This gift card has expired";
  if (gc.balance <= 0) return "This gift card has no balance left";
  return null;
}

async function log(code: string, entry: GiftCard["history"][number]) {
  const raw = await db.cmd<string | null>(["GET", `gc:${code}`]);
  if (!raw) return;
  const gc = JSON.parse(raw) as GiftCard;
  gc.history = [...gc.history, entry].slice(-200);
  await db.cmd(["SET", `gc:${code}`, JSON.stringify(gc)]);
}

/** Take money off a card (atomic). Throws if the balance isn't there any more. */
export async function spendGiftCard(code: string, amount: number, orderId: string) {
  const c = norm(code);
  const left = await db.cmd<number>(["INCRBY", `gc:bal:${c}`, -cents(amount)]);
  if (Number(left) < 0) {
    await db.cmd(["INCRBY", `gc:bal:${c}`, cents(amount)]);
    throw new Error("Your gift card balance changed. Please review your order.");
  }
  await log(c, { at: new Date().toISOString(), amount: -amount, orderId });
}

/** Put money back (cancelled order, refund to gift card, or a manual top-up). */
export async function creditGiftCard(code: string, amount: number, note: string, orderId?: string) {
  const c = norm(code);
  await db.cmd(["INCRBY", `gc:bal:${c}`, cents(amount)]);
  await log(c, { at: new Date().toISOString(), amount, orderId, note });
}

export async function setGiftCardDisabled(code: string, disabled: boolean) {
  const c = norm(code);
  const raw = await db.cmd<string | null>(["GET", `gc:${c}`]);
  if (!raw) return false;
  await db.cmd(["SET", `gc:${c}`, JSON.stringify({ ...(JSON.parse(raw) as GiftCard), disabled })]);
  return true;
}
