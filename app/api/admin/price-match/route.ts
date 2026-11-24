import { NextResponse, after } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { siteUrl } from "@/lib/site-url";

export const maxDuration = 300;

/** Last price check: shops read, products matched, prices matched and items flagged. */
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  return NextResponse.json(await (await import("@/lib/price-match")).getReport());
}

/** "Check prices now": starts a run in the background (it takes a few minutes). */
export async function POST() {
  const denied = await adminGuard();
  if (denied) return denied;
  const secret = process.env.CRON_SECRET;
  after(() => fetch(`${siteUrl()}/api/cron/price-match/`, { headers: secret ? { authorization: `Bearer ${secret}` } : {}, cache: "no-store" }).catch((e) => console.error("[price-match start]", e)));
  return NextResponse.json({ ok: true });
}
