import { NextResponse, after, type NextRequest } from "next/server";

// Nightly price check (Vercel Cron, see vercel.json). Each call answers at once and does its
// work afterwards: one shop (or the final "apply" step), then it calls itself for the next one.
// Answering first means no call waits on the next, so each gets its own full time limit.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Call ourselves on the address this request came in on: going through shopsuperyou.com would
  // redirect to www and the redirect drops the Authorization header, so the next step was refused.
  const self = new URL(req.url).origin;
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const hop = Number(req.nextUrl.searchParams.get("hop") ?? "0");
  after(async () => {
    const pm = await import("@/lib/price-match");
    if (!hop) {
      // A check started less than an hour ago is still going: don't start a second one over it.
      const { running } = await pm.getReport();
      if (running && Date.now() - Date.parse(running.startedAt) < 60 * 60_000) return;
      await pm.startRun();
    }
    const { more } = await pm.step().catch((e) => (console.error("[price-match step]", e), { more: false }));
    if (more && hop < 120) // 39 shops, big ones take several steps
      await fetch(`${self}/api/cron/price-match/?hop=${hop + 1}`, { headers: secret ? { authorization: `Bearer ${secret}` } : {}, cache: "no-store" }).catch((e) => console.error("[price-match chain]", e));
  });
  return NextResponse.json({ ok: true, hop });
}
