// Admin sessions shared by proxy.ts (which checks every /admin request) and server code.
// The owner signs in with ADMIN_PASSWORD; staff sign in with their email and own password.
// No "server-only" import here because proxy.ts uses it too; it never reaches the browser.

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db-core";
import type { Role } from "@/lib/roles";

export const ADMIN_COOKIE = "admin_session";
export const MAX_AGE = 60 * 60 * 24 * 7;

export type StaffMember = {
  email: string; // lower case, the login
  name: string;
  role: Exclude<Role, "owner"> | "owner";
  hash: string; // scrypt salt:hash
  ver: number; // bumping it signs the person out everywhere
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
};

export type AdminUser = { id: string; name: string; role: Role };

export function adminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? "admin" : null);
}

const secret = () => process.env.ADMIN_SECRET || `pw:${adminPassword()}`;
export const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkOwnerPassword(input: string) {
  const pw = adminPassword();
  return !!pw && safeEqual(sign(`check:${input}`), sign(`check:${pw}`));
}

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string) {
  const [salt, hash] = stored.split(":");
  return !!salt && !!hash && safeEqual(scryptSync(pw, salt, 32).toString("hex"), hash);
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString();

/** Cookie value: expiry.who.version.signature (who = "owner" or the staff email, base64url). */
export function sessionValue(who: string, ver = 0) {
  const exp = String(Date.now() + MAX_AGE * 1000);
  const body = `${exp}.${b64(who)}.${ver}`;
  return `${body}.${sign(body)}`;
}

export function cookieOptions(value: string) {
  return { name: ADMIN_COOKIE, value, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: MAX_AGE };
}

export async function getStaff(email: string): Promise<StaffMember | null> {
  const raw = await db.cmd<string | null>(["HGET", "staff", email.trim().toLowerCase()]);
  return raw ? (JSON.parse(raw) as StaffMember) : null;
}

/** Who is signed in, from the raw cookie value (null = nobody / expired / revoked). */
export async function userFromCookie(value: string | undefined): Promise<AdminUser | null> {
  if (!adminPassword() || !value) return null;
  const parts = value.split(".");
  // Sessions from before staff accounts existed: expiry.signature = the owner.
  if (parts.length === 2) {
    const [exp, sig] = parts;
    return Number(exp) > Date.now() && safeEqual(sig, sign(exp)) ? { id: "owner", name: "Owner", role: "owner" } : null;
  }
  if (parts.length !== 4) return null;
  const [exp, who64, ver, sig] = parts;
  if (!(Number(exp) > Date.now()) || !safeEqual(sig, sign(`${exp}.${who64}.${ver}`))) return null;
  const who = unb64(who64);
  if (who === "owner") return { id: "owner", name: "Owner", role: "owner" };
  const s = await getStaff(who).catch(() => null);
  if (!s || !s.active || String(s.ver) !== ver) return null;
  return { id: s.email, name: s.name, role: s.role };
}

/** Activity log: who changed what, newest kept. */
export async function audit(who: string, action: string, detail = "") {
  const at = Date.now();
  await db.pipeline([
    ["ZADD", "audit", at, JSON.stringify({ at, who, action, detail: detail.slice(0, 300), r: randomBytes(3).toString("hex") })],
    ["ZREMRANGEBYRANK", "audit", 0, -3001],
  ]);
}

/** Cookie value that unlocks the private preview (SITE_PASSWORD). */
export const lockToken = (pw: string) => sign(`site-lock:${pw}`).slice(0, 32);
