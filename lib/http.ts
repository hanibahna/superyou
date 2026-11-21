import type { NextRequest } from "next/server";

/** Public base URL (set NEXT_PUBLIC_SITE_URL in production). */
export function baseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || (req.nextUrl.hostname.endsWith("shopsuperyou.com") ? "https://shopsuperyou.com" : req.nextUrl.origin);
}
