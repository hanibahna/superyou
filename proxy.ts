import { NextResponse, type NextRequest } from "next/server";

// French and Arabic pages live at /fr/… and /ar/… so Google can index them. The same pages are served,
// with the Arabic interface switched on (see app/layout.tsx).
export function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const lang = url.pathname.startsWith("/fr") ? "fr" : "ar";
  url.pathname = url.pathname.replace(/^\/(ar|fr)(?=\/|$)/, "") || "/";
  const h = new Headers(req.headers);
  h.set("x-lang", lang);
  const res = NextResponse.rewrite(url, { request: { headers: h } });
  // Remember the choice so in-page requests (cart, routine finder…) answer in the same language.
  if (req.cookies.get("lang")?.value !== lang) res.cookies.set("lang", lang, { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
}

export const config = { matcher: ["/ar", "/ar/:path*", "/fr", "/fr/:path*"] };
