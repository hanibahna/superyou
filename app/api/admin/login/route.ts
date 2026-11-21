import { NextResponse, type NextRequest } from "next/server";
import { adminPassword, checkPassword, sessionCookie } from "@/lib/admin-auth";

const attempts = new Map<string, { n: number; until: number }>();

export async function POST(req: NextRequest) {
  if (!adminPassword()) return NextResponse.json({ error: "Set ADMIN_PASSWORD in your Vercel environment variables first." }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const a = attempts.get(ip);
  if (a && a.n >= 5 && a.until > Date.now()) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password || !checkPassword(password)) {
    const n = (a && a.until > Date.now() ? a.n : 0) + 1;
    attempts.set(ip, { n, until: Date.now() + 15 * 60_000 });
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie());
  return res;
}
