import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, audit, userFromCookie } from "@/lib/admin-session";
import { areaOf, can } from "@/lib/roles";

const OPEN = /^\/(api\/)?admin\/(login|logout)(\/|$)/;

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/admin") || path.startsWith("/api/admin")) return adminGate(req, path);

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

export const config = { matcher: ["/ar", "/ar/:path*", "/fr", "/fr/:path*", "/admin", "/admin/:path*", "/api/admin/:path*"] };
