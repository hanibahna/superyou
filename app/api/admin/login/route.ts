import { NextResponse, type NextRequest } from "next/server";
import { adminPassword, checkPassword, sessionCookie } from "@/lib/admin-auth";
import { audit, getStaff, verifyPassword } from "@/lib/admin-session";
import { db } from "@/lib/db";

const attempts = new Map<string, { n: number; until: number }>();

// Owner: password only (ADMIN_PASSWORD). Staff: email + their own password.
export async function POST(req: NextRequest) {
  if (!adminPassword()) return NextResponse.json({ error: "Set ADMIN_PASSWORD in your Vercel environment variables first." }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const a = attempts.get(ip);
  if (a && a.n >= 5 && a.until > Date.now()) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });

  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  let cookie: ReturnType<typeof sessionCookie> | null = null;
  if (password && email?.trim()) {
    const s = await getStaff(email);
    if (s && s.active && verifyPassword(password, s.hash)) {
      cookie = sessionCookie(s.email, s.ver);
      await db.cmd(["HSET", "staff", s.email, JSON.stringify({ ...s, lastLoginAt: new Date().toISOString() })]);
      await audit(`${s.name} (${s.email})`, "signed in").catch(() => {});
    }
  } else if (password && checkPassword(password)) {
    cookie = sessionCookie("owner");
    await audit("Owner", "signed in").catch(() => {});
  }
  if (!cookie) {
    const n = (a && a.until > Date.now() ? a.n : 0) + 1;
    attempts.set(ip, { n, until: Date.now() + 15 * 60_000 });
    return NextResponse.json({ error: email?.trim() ? "Wrong email or password." : "Wrong password." }, { status: 401 });
  }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie);
  return res;
}
