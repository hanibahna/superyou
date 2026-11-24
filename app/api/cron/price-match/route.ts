import { NextResponse, after, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/site-url";

// Nightly price check (Vercel Cron, see vercel.json). Each call answers at once and does its
// work afterwards: one shop (or the final "apply" step), then it calls itself for the next one.
// Answering first means no call waits on the next, so each gets its own full time limit.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const hop = Number(req.nextUrl.searchParams.get("hop") ?? "0");
  after(async () => {
    const pm = await import("@/lib/price-match");
    if (!hop) await pm.startRun();
    const { more } = await pm.step().catch((e) => (console.error("[price-match step]", e), { more: false }));
    if (more && hop < 40)
      await fetch(`${siteUrl()}/api/cron/price-match/?hop=${hop + 1}`, { headers: secret ? { authorization: `Bearer ${secret}` } : {}, cache: "no-store" }).catch((e) => console.error("[price-match chain]", e));
  });
  return NextResponse.json({ ok: true, hop });
}
