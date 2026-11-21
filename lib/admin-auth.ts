import "server-only";

// Admin sign-in. The owner uses ADMIN_PASSWORD (set in Vercel); staff accounts are added in
// Admin → Staff. proxy.ts also checks each admin page and API call against the person's role.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { cache } from "react";
import { ADMIN_COOKIE, adminPassword, checkOwnerPassword, cookieOptions, sessionValue, userFromCookie, type AdminUser } from "@/lib/admin-session";
import { can, type Area } from "@/lib/roles";

export { ADMIN_COOKIE, adminPassword };

export const checkPassword = checkOwnerPassword;
export const sessionCookie = (who = "owner", ver = 0) => cookieOptions(sessionValue(who, ver));

export const currentAdmin = cache(async (): Promise<AdminUser | null> => userFromCookie((await cookies()).get(ADMIN_COOKIE)?.value));

export async function isAdmin(): Promise<boolean> {
  return !!(await currentAdmin());
}

/** For admin pages. */
export async function requireAdmin(area?: Area): Promise<AdminUser> {
  const u = await currentAdmin();
  if (!u) redirect("/admin/login/");
  if (area && !can(u.role, area)) redirect("/admin/?denied=1");
  return u;
}

/** For admin API routes: returns a 401/403 response, or null when allowed. */
export async function adminGuard(area?: Area): Promise<NextResponse | null> {
  const u = await currentAdmin();
  if (!u) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (area && !can(u.role, area)) return NextResponse.json({ error: "Your account can't do this" }, { status: 403 });
  return null;
}
