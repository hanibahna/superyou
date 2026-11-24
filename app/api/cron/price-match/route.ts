import { NextResponse, after, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/site-url";

// Nightly price check (Vercel Cron, see vercel.json). Each call does one shop (or the final
// "apply" step) and then calls itself for the next one, so no call runs into the time limit.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const pm = await import("@/lib/price-match");
  const hop = Number(req.nextUrl.searchParams.get("hop") ?? "0");
  if (!hop) await pm.startRun();
  const { more } = await pm.step();
  if (more && hop < 40) {
    after(() =>
      fetch(`${siteUrl()}/api/cron/price-match/?hop=${hop + 1}`, { headers: secret ? { authorization: `Bearer ${secret}` } : {}, cache: "no-store" }).catch((e) => console.error("[price-match chain]", e)),
    );
  }
  return NextResponse.json({ ok: true, hop, more });
}
