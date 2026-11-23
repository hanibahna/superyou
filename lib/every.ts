// How often a subscribed product is delivered, in months. Client-safe.
// Each product gets its own frequency from how long it lasts (lib/lifespan.ts). The discount has
// two tiers: monthly plans get the "monthly" %, longer ones the "every 3 months" %.
import { z } from "zod";

export const EVERY = [1, 2, 3, 4, 6] as const;
export type Every = (typeof EVERY)[number];
export const everySchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6)]);
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
