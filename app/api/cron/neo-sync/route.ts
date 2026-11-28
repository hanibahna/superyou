import { NextResponse, after, type NextRequest } from "next/server";

// NeoVitale catalog sync every 3 days (Vercel Cron, see vercel.json). Same chaining as the
// price check: answer at once (?hop=1 resumes a run that stopped part-way; the 04:00 and 05:00 crons do that), do one step afterwards, then call itself for the next step.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Call ourselves on the address this request came in on: going through shopsuperyou.com would
  // redirect to www and the redirect drops the Authorization header, so the next step was refused.
  const self = new URL(req.url).origin;
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const sync = await import("@/lib/neo-sync");
  if (req.nextUrl.searchParams.has("status")) {
    // Counts only: product names stay in the admin and the email.
    const r = (await sync.currentSync()) ?? (await sync.lastSync());
    return NextResponse.json(r ? { startedAt: r.startedAt, finishedAt: r.finishedAt ?? null, done: r.done, page: r.page, added: r.added.length, addedSoldOut: r.addedSoldOut.length, priceUp: r.priceUp.length, priceDown: r.priceDown.length, costFixed: r.costFixed, backInStock: r.backInStock.length, nowSoldOut: r.nowSoldOut.length, gone: r.gone.length, errors: r.errors.length } : { none: true });
  }
  const hop = Number(req.nextUrl.searchParams.get("hop") ?? "0");
  after(async () => {
    if (!hop) await sync.startSync();
    const { more } = await sync.stepSync().catch((e) => (console.error("[neo-sync step]", e), { more: false }));
    if (more && hop < 200)
      await fetch(`${self}/api/cron/neo-sync/?hop=${hop + 1}`, { headers: secret ? { authorization: `Bearer ${secret}` } : {}, cache: "no-store" }).catch((e) => console.error("[neo-sync chain]", e));
  });
  return NextResponse.json({ ok: true, hop });
}
