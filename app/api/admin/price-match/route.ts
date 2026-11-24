import { NextResponse } from "next/server";
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
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const secret = process.env.CRON_SECRET;
  // A run that stopped half-way (state still there) is continued instead of restarted.
  const { running } = await (await import("@/lib/price-match")).getReport();
  const body = (await req.json().catch(() => ({}))) as { resume?: boolean; sync?: boolean };
  // Run one step right here and show what happened (for checking a stuck run).
  if (body.sync && running) {
    const t = Date.now();
    try {
      const r = await (await import("@/lib/price-match")).step();
      return NextResponse.json({ ok: true, ms: Date.now() - t, more: r.more, state: r.state });
    } catch (e) {
      return NextResponse.json({ ok: false, ms: Date.now() - t, error: (e as Error).message, stack: (e as Error).stack?.split("\n").slice(0, 5) }, { status: 500 });
    }
  }
  const resume = running && body.resume;
  await (async () => fetch(`${siteUrl()}/api/cron/price-match/${resume ? "?hop=1" : ""}`, { headers: secret ? { authorization: `Bearer ${secret}` } : {}, cache: "no-store" }).catch((e) => console.error("[price-match start]", e)))();
  return NextResponse.json({ ok: true });
}
