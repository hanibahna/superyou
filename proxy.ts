import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, audit, lockToken, userFromCookie } from "@/lib/admin-session";
import { areaOf, can } from "@/lib/roles";

const OPEN = /^\/(api\/)?admin\/(login|logout)(\/|$)/;

// Private preview: when SITE_PASSWORD is set in Vercel, the shop asks for it before showing anything.
// The admin keeps its own login; payment returns, webhooks and the daily job keep working.
const LOCK_FREE = /^\/(admin|api\/admin|api\/webhooks|api\/cron|api\/payments|api\/site-lock|site-lock|img\/|brand|icon|apple-icon|feeds\/|api\/app\/|robots\.txt|favicon)/;

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const pw = process.env.SITE_PASSWORD;
  if (pw && !LOCK_FREE.test(path) && req.cookies.get("site_lock")?.value !== lockToken(pw)) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "This site is private for now." }, { status: 401 });
    const to = new URL("/site-lock/", req.url);
    to.searchParams.set("next", path + req.nextUrl.search);
    const res = NextResponse.redirect(to);
    res.headers.set("X-Robots-Tag", "noindex");
    return res;
  }
  if (path.startsWith("/admin") || path.startsWith("/api/admin")) return adminGate(req, path);
  if (!/^\/(ar|fr)(\/|$)/.test(path)) return NextResponse.next();

  // French and Arabic pages live at /fr/… and /ar/… so Google can index them. The same pages are served,
  // with the Arabic interface switched on (see app/layout.tsx).
  const url = req.nextUrl.clone();
  const lang = path.startsWith("/fr") ? "fr" : "ar";
  url.pathname = path.replace(/^\/(ar|fr)(?=\/|$)/, "") || "/";
  const h = new Headers(req.headers);
  h.set("x-lang", lang);
  const res = NextResponse.rewrite(url, { request: { headers: h } });
  // Remember the choice so in-page requests (cart, routine finder…) answer in the same language.
  if (req.cookies.get("lang")?.value !== lang) res.cookies.set("lang", lang, { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
}

/** Every admin page and admin API call: signed in, and allowed for this person's role. Changes are logged. */
async function adminGate(req: NextRequest, path: string) {
  if (OPEN.test(path)) return NextResponse.next();
  const api = path.startsWith("/api/");
  const user = await userFromCookie(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!user) return api ? NextResponse.json({ error: "Not signed in" }, { status: 401 }) : NextResponse.redirect(new URL("/admin/login/", req.url));
  const area = areaOf(path);
  if (!can(user.role, area)) {
    return api ? NextResponse.json({ error: "Your account can't do this" }, { status: 403 }) : NextResponse.redirect(new URL("/admin/?denied=1", req.url));
  }
  if (api && req.method !== "GET" && req.method !== "HEAD") await audit(user.name === "Owner" ? "Owner" : `${user.name} (${user.id})`, `${req.method} ${path.replace(/^\/api\/admin\//, "").replace(/\/$/, "")}`).catch(() => {});
  return NextResponse.next();
}

// Everything except Next's own static files (needed for the private-preview lock).
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
