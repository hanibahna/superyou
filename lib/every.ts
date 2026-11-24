// How often a subscribed product is delivered, in months. Client-safe.
// Each product gets its own frequency from how long it lasts (lib/lifespan.ts). The discount has
// two tiers: monthly plans get the "monthly" %, longer ones the "every 3 months" %.
import { z } from "zod";

export const EVERY = [1, 2, 3, 4, 5, 6] as const;
/** How long a plan runs, in months (the customer picks; 6 at most). */
export const MAX_MONTHS = 6;
export const forSchema = z.number().int().min(1).max(MAX_MONTHS);
export type Every = (typeof EVERY)[number];
export const everySchema = z.number().int().min(1).max(6).transform((n) => n as Every);
/** Date of the next delivery the customer picked on a calendar (YYYY-MM-DD). */
export const startSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** Today + n months, as YYYY-MM-DD (same day of the month, or the last day). */
export function monthsFrom(n: number, from = new Date()) {
  const d = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate(), 12));
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
/** A picked date is accepted from tomorrow up to 13 months ahead. */
export const startOk = (d?: string) => !!d && d > monthsFrom(0) && d <= monthsFrom(MAX_MONTHS);
export const isEvery = (n: unknown): n is Every => EVERY.includes(n as Every);
export const everyLabel = (e: number) => (e === 1 ? "Every month" : `Every ${e} months`);
export const everyText = (e: number) => (e === 1 ? "every month" : `every ${e} months`);
/** Discount tier: monthly, or longer (2+ months). */
export const tierOf = (e: number): "monthly" | "quarterly" => (e === 1 ? "monthly" : "quarterly");
/** The plan for a product that lasts `days`: the closest one, leaning shorter so it arrives before
 * the last one runs out (never more often than monthly). */
export function everyForDays(days: number): Every {
  const m = (days / 30.4) * 0.9;
  let best: Every = 1;
  for (const e of EVERY) if (Math.abs(e - m) < Math.abs(best - m)) best = e;
  return best;
}
/** Options to offer: the recommended plan, and one step more often if there is one. */
export function everyOptions(rec: Every): Every[] {
  const i = EVERY.indexOf(rec);
  return i > 0 ? [rec, EVERY[i - 1]] : [rec];
}
