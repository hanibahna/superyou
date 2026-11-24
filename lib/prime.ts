import "server-only";

// SuperPrime membership, kept per phone number. See Prime in lib/growth.ts.
import { db } from "@/lib/db";
import { normPhone } from "@/lib/wa";

export type PrimeRecord = { phone: string; since: string; trialUntil?: string; paidUntil?: string; orders?: string[] };
export type PrimeStatus = "none" | "trial" | "active" | "lapsed";
export type PrimeChoice = "trial" | "join";

const KEY = (phone: string) => `prime:${normPhone(phone)}`;
const DAY = 86400_000;

export async function getPrime(phone?: string): Promise<PrimeRecord | null> {
  if (!phone || !normPhone(phone)) return null;
  const raw = await db.cmd<string | null>(["GET", KEY(phone)]);
  return raw ? (JSON.parse(raw) as PrimeRecord) : null;
}

/** Member now? Until when, and was the free trial already used? */
export function primeState(r: PrimeRecord | null, now = Date.now()): { status: PrimeStatus; until?: string; trialUsed: boolean } {
  if (!r) return { status: "none", trialUsed: false };
  const trial = r.trialUntil ? Date.parse(r.trialUntil) : 0;
  const paid = r.paidUntil ? Date.parse(r.paidUntil) : 0;
  const end = Math.max(trial, paid);
  if (end > now) return { status: paid > now ? "active" : "trial", until: new Date(end).toISOString(), trialUsed: !!r.trialUntil };
  return { status: "lapsed", until: end ? new Date(end).toISOString() : undefined, trialUsed: !!r.trialUntil };
}

/** After an order: start the trial or add 30 paid days (from the end of any current period). */
export async function activatePrime(phone: string, choice: PrimeChoice, trialMonths: number, orderId: string) {
  const r: PrimeRecord = (await getPrime(phone)) ?? { phone: normPhone(phone), since: new Date().toISOString() };
  const now = Date.now();
  const end = Math.max(now, r.trialUntil ? Date.parse(r.trialUntil) : 0, r.paidUntil ? Date.parse(r.paidUntil) : 0);
  if (choice === "trial") {
    if (r.trialUntil) return r; // one free trial per number
    const d = new Date(now);
    d.setMonth(d.getMonth() + trialMonths);
    r.trialUntil = d.toISOString();
  } else r.paidUntil = new Date(end + 30 * DAY).toISOString();
  r.orders = [...(r.orders ?? []), orderId].slice(-50);
  await db.cmd(["SET", KEY(phone), JSON.stringify(r)]);
  await db.cmd(["SADD", "prime:members", normPhone(phone)]);
  return r;
}

export async function primeCount(): Promise<number> {
  return Number((await db.cmd<number>(["SCARD", "prime:members"])) ?? 0);
}
