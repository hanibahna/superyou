import "server-only";

import { db } from "@/lib/db";
import { getStaff, hashPassword, type StaffMember } from "@/lib/admin-session";
import type { Role } from "@/lib/roles";

export type StaffPublic = Omit<StaffMember, "hash">;

export async function listStaff(): Promise<StaffPublic[]> {
  const flat = await db.cmd<string[]>(["HGETALL", "staff"]);
  const out: StaffPublic[] = [];
  for (let i = 1; i < flat.length; i += 2) {
    const { hash: _h, ...s } = JSON.parse(flat[i]) as StaffMember;
    out.push(s);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const put = (s: StaffMember) => db.cmd(["HSET", "staff", s.email, JSON.stringify(s)]);

export async function addStaff(input: { email: string; name: string; role: Exclude<Role, "owner">; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (await getStaff(email)) throw new Error("Someone already uses that email");
  await put({ email, name: input.name.trim(), role: input.role, hash: hashPassword(input.password), ver: 1, active: true, createdAt: new Date().toISOString() });
}

export async function updateStaff(email: string, patch: { name?: string; role?: Exclude<Role, "owner">; active?: boolean; password?: string }) {
  const s = await getStaff(email);
  if (!s) throw new Error("Staff member not found");
  const next: StaffMember = { ...s, ...(patch.name ? { name: patch.name.trim() } : {}), ...(patch.role ? { role: patch.role } : {}), ...(patch.active !== undefined ? { active: patch.active } : {}) };
  // A new password, a new role or switching someone off signs them out everywhere.
  if (patch.password) next.hash = hashPassword(patch.password);
  if (patch.password || (patch.role && patch.role !== s.role) || patch.active === false) next.ver = s.ver + 1;
  await put(next);
}

export const removeStaff = (email: string) => db.cmd(["HDEL", "staff", email.trim().toLowerCase()]);

export async function auditLog(limit = 300): Promise<{ at: number; who: string; action: string; detail: string }[]> {
  const raw = await db.cmd<string[]>(["ZREVRANGE", "audit", 0, limit - 1]);
  return raw.map((r) => JSON.parse(r));
}
