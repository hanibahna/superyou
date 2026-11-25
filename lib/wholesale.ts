import "server-only";

import { db } from "@/lib/db";

// Wholesale enquiries from the /wholesale/ form: kept for the admin and sent to the team.
export type WholesaleRequest = { id: string; at: string; business: string; type: string; contact: string; phone: string; email: string; city: string; volume: string; categories: string[]; brands: string; message: string; status: "new" | "contacted" | "approved" | "declined" };
const LIST = "wholesale:requests";

export async function addWholesale(r: Omit<WholesaleRequest, "id" | "at" | "status">) {
  const w: WholesaleRequest = { ...r, id: `WS-${Date.now().toString(36).toUpperCase()}`, at: new Date().toISOString(), status: "new" };
  await db.cmd(["HSET", LIST, w.id, JSON.stringify(w)]);
  return w;
}
export async function listWholesale(): Promise<WholesaleRequest[]> {
  const flat = (await db.cmd<string[] | null>(["HGETALL", LIST])) ?? [];
  const out: WholesaleRequest[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push(JSON.parse(flat[i + 1]));
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
export async function setWholesaleStatus(id: string, status: WholesaleRequest["status"]) {
  const raw = await db.cmd<string | null>(["HGET", LIST, id]);
  if (raw) await db.cmd(["HSET", LIST, id, JSON.stringify({ ...JSON.parse(raw), status })]);
}
