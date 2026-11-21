import "server-only";

// Single-password admin login, signed cookie, 7-day sessions.
// Set ADMIN_PASSWORD in Vercel (and optionally ADMIN_SECRET for cookie signing).

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export function adminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? "admin" : null);
}

function secret() {
  return process.env.ADMIN_SECRET || `pw:${adminPassword()}`;
}

const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(input: string) {
  const pw = adminPassword();
  return !!pw && safeEqual(sign(`check:${input}`), sign(`check:${pw}`));
}

export function sessionCookie() {
  const exp = String(Date.now() + MAX_AGE * 1000);
  return {
    name: COOKIE,
    value: `${exp}.${sign(exp)}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}

export async function isAdmin(): Promise<boolean> {
  if (!adminPassword()) return false;
  const v = (await cookies()).get(COOKIE)?.value ?? "";
  const [exp, sig] = v.split(".");
  return !!exp && !!sig && Number(exp) > Date.now() && safeEqual(sig, sign(exp));
}

/** For admin pages. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login/");
}

/** For admin API routes: returns a 401 response, or null when allowed. */
export async function adminGuard(): Promise<NextResponse | null> {
  return (await isAdmin()) ? null : NextResponse.json({ error: "Not signed in" }, { status: 401 });
}

export const ADMIN_COOKIE = COOKIE;
