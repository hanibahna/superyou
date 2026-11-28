import { NextResponse } from "next/server";

// Public: when the last price check finished (for "Last checked …" on product pages).
export async function GET() {
  const { report } = await (await import("@/lib/price-match")).getReport().catch(() => ({ report: null }));
  return NextResponse.json({ at: report?.at ?? null }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
