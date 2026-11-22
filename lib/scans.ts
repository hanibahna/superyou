import "server-only";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/site-url";

// Saved AI skin scans (never the photo): the reading and the routine, so customers can get them on
// WhatsApp or email, see them in their account, and compare when they rescan. A follow-up message
// goes out 6 weeks later inviting them to rescan.
export const savedScanSchema = z.object({
  analysis: z.object({
    skinType: z.string().max(40).optional(),
    concerns: z.array(z.string().max(60)).max(5),
    sensitive: z.boolean(),
    observations: z.array(z.string().max(200)).max(6),
    advice: z.string().max(400).default(""),
    zones: z.array(z.object({ zone: z.string().max(30), note: z.string().max(200) })).max(6).optional(),
    confidence: z.string().max(10).optional(),
    redFlags: z.array(z.string().max(200)).max(5).optional(),
  }),
  steps: z.array(z.object({ name: z.string().max(60), time: z.string().max(10), tip: z.string().max(300), product: z.object({ slug: z.string().max(200), name: z.string().max(200), brand: z.string().max(80), price: z.number() }).nullable() })).max(10),
});
export type SavedScan = z.infer<typeof savedScanSchema> & { id: string; token: string; phone: string; email: string; name: string; createdAt: string; followAt: string; followed: boolean };

const K = (id: string) => `scan:${id}`;
const byPhone = (p: string) => `scan:p:${p.replace(/\D/g, "")}`;
const FOLLOW = "scan:follow";

export async function saveScan(s: Omit<SavedScan, "id" | "token" | "createdAt" | "followAt" | "followed">) {
  const scan: SavedScan = { ...s, id: `SC-${Date.now().toString(36).toUpperCase()}`, token: randomBytes(12).toString("hex"), createdAt: new Date().toISOString(), followAt: new Date(Date.now() + 42 * 864e5).toISOString(), followed: false };
  await db.cmd(["SET", K(scan.id), JSON.stringify(scan)]);
  if (scan.phone) {
    await db.cmd(["ZADD", byPhone(scan.phone), String(Date.now()), scan.id]);
    // Only the latest scan per customer gets the 6-week follow-up.
    const prev = await db.cmd<string[]>(["ZRANGE", byPhone(scan.phone), "0", "-1"]).catch(() => [] as string[]);
    for (const id of prev) if (id !== scan.id) await db.cmd(["ZREM", FOLLOW, id]).catch(() => {});
    await db.cmd(["ZADD", FOLLOW, String(Date.parse(scan.followAt)), scan.id]);
  }
  return scan;
}
export async function getScan(id: string): Promise<SavedScan | null> {
  const raw = await db.cmd<string | null>(["GET", K(id)]).catch(() => null);
  return raw ? (JSON.parse(raw) as SavedScan) : null;
}
export async function scansByPhone(phone: string): Promise<SavedScan[]> {
  const ids = await db.cmd<string[]>(["ZREVRANGE", byPhone(phone), "0", "19"]).catch(() => [] as string[]);
  return (await Promise.all(ids.map(getScan))).filter((x): x is SavedScan => !!x);
}
export const scanLink = (s: SavedScan) => `${siteUrl()}/skin-scan/r/${s.id}/?t=${s.token}`;
export const routineText = (s: SavedScan) => s.steps.filter((x) => x.product).map((x, i) => `${i + 1}. ${x.name} (${x.time === "both" ? "AM+PM" : x.time.toUpperCase()}): ${x.product!.brand} ${x.product!.name}`).join("\n");

/** Daily (cron): 6 weeks after a scan, invite the customer to rescan and see their progress. */
export async function runScanFollowUps() {
  const due = await db.cmd<string[]>(["ZRANGEBYSCORE", FOLLOW, "0", String(Date.now()), "LIMIT", "0", "50"]).catch(() => [] as string[]);
  const wa = await import("@/lib/whatsapp");
  let sent = 0;
  for (const id of due) {
    const s = await getScan(id);
    await db.cmd(["ZREM", FOLLOW, id]).catch(() => {});
    if (!s || s.followed || !s.phone) continue;
    await wa.trigger("skinScanFollowUp", s.phone, { first_name: s.name.split(" ")[0] || "there", link: `${siteUrl()}/skin-scan/?from=${s.id}&t=${s.token}` }).catch(() => false);
    await db.cmd(["SET", K(id), JSON.stringify({ ...s, followed: true })]);
    sent++;
  }
  return sent;
}
