import { limited } from "@/lib/ratelimit";
import { NextResponse, type NextRequest } from "next/server";
import { lockToken, safeEqual } from "@/lib/admin-session";

const tries = new Map<string, { n: number; until: number }>();

// The private-preview password form posts here.
export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "lock", 30);
  if (tooMany) return tooMany;
  const pw = process.env.SITE_PASSWORD;
  const f = await req.formData();
  const next = String(f.get("next") ?? "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (!pw) return NextResponse.redirect(new URL(safeNext, req.url), 303);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const t = tries.get(ip);
  if (t && t.n >= 8 && t.until > Date.now()) return NextResponse.redirect(new URL(`/site-lock/?e=wait&next=${encodeURIComponent(safeNext)}`, req.url), 303);
  if (!safeEqual(String(f.get("password") ?? ""), pw)) {
    tries.set(ip, { n: (t && t.until > Date.now() ? t.n : 0) + 1, until: Date.now() + 15 * 60_000 });
    return NextResponse.redirect(new URL(`/site-lock/?e=1&next=${encodeURIComponent(safeNext)}`, req.url), 303);
  }
  tries.delete(ip);
  const res = NextResponse.redirect(new URL(safeNext, req.url), 303);
  res.cookies.set("site_lock", lockToken(pw), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
