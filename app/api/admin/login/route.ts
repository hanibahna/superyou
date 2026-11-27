import { NextResponse, after, type NextRequest } from "next/server";
import { adminPassword, checkPassword, sessionCookie } from "@/lib/admin-auth";
import { audit, getStaff, verifyPassword } from "@/lib/admin-session";
import { db } from "@/lib/db";
import { check2fa, has2fa, signInAlert, signInBlocked, signInCleared, signInFailed } from "@/lib/admin-security";

// Owner: password only (ADMIN_PASSWORD). Staff: email + their own password.
// Then, for anyone who has set it up, the 6-digit code from their authenticator app.
// Failed tries are counted in Redis (shared by every server): 5 per address / 10 per account per 15 minutes.
export async function POST(req: NextRequest) {
  if (!adminPassword()) return NextResponse.json({ error: "Set ADMIN_PASSWORD in your Vercel environment variables first." }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ua = req.headers.get("user-agent") ?? "";
  const { email, password, code } = (await req.json().catch(() => ({}))) as { email?: string; password?: string; code?: string };
  const account = email?.trim() ? email.trim().toLowerCase() : "owner";
  if (await signInBlocked(ip, account)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });

  let who: { id: string; name: string; cookie: ReturnType<typeof sessionCookie>; staff?: Awaited<ReturnType<typeof getStaff>> } | null = null;
  if (password && email?.trim()) {
    const s = await getStaff(email);
    if (s && s.active && verifyPassword(password, s.hash)) who = { id: s.email, name: `${s.name} (${s.email})`, cookie: sessionCookie(s.email, s.ver), staff: s };
  } else if (password && checkPassword(password)) {
    who = { id: "owner", name: "Owner", cookie: sessionCookie("owner") };
  }
  if (!who) {
    await signInFailed(ip, account);
    return NextResponse.json({ error: email?.trim() ? "Wrong email or password." : "Wrong password." }, { status: 401 });
  }

  const twoStep = await has2fa(who.id);
  if (twoStep) {
    if (!code) return NextResponse.json({ need2fa: true, error: "Enter the 6-digit code from your authenticator app." }, { status: 401 });
    if (!(await check2fa(who.id, code))) {
      await signInFailed(ip, account);
      return NextResponse.json({ need2fa: true, error: "That code didn't work. Use the newest code in your authenticator app." }, { status: 401 });
    }
  }

  await signInCleared(ip, account);
  if (who.staff) await db.cmd(["HSET", "staff", who.staff.email, JSON.stringify({ ...who.staff, lastLoginAt: new Date().toISOString() })]);
  await audit(who.name, twoStep ? "signed in (with authenticator code)" : "signed in").catch(() => {});
  const name = who.name;
  after(() => signInAlert(name, ip, ua, twoStep));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(who.cookie);
  return res;
}
