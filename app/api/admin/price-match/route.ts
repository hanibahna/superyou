import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { siteUrl } from "@/lib/site-url";

export const maxDuration = 300;

/** Last price check: shops read, products matched, prices matched and items flagged. */
export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const u = new URL(req.url);
  if (u.searchParams.has("analyse"))
    return NextResponse.json(await (await import("@/lib/price-match")).analyse(Number(u.searchParams.get("beat") ?? 5), Number(u.searchParams.get("margin") ?? 10), Number(u.searchParams.get("assume") ?? 0)));
  if (u.searchParams.has("competitors")) {
    const pm = await import("@/lib/price-match");
    const { getIndex } = await import("@/lib/catalog");
    const all = (await getIndex()).all.filter((p) => p.status === "active");
    const text = (p: (typeof all)[number]) => `${p.name} ${p.category} ${(p.tags ?? []).join(" ")}`;
    const cats = new Map<string, number>();
    for (const p of all) cats.set(p.category, (cats.get(p.category) ?? 0) + 1);
    const us = {
      label: "SuperYou", products: all.length, brands: new Set(all.map((p) => p.brand.trim().toUpperCase())).size,
      inStock: all.filter((p) => p.inStock).length,
      supplements: all.filter((p) => pm.SUPP.test(text(p)) && !/\b(hair|shampoo|conditioner|serum|cream|lotion)\b/i.test(p.name)).length,
      protein: all.filter((p) => pm.PROTEIN.test(text(p)) && !/\b(hair|shampoo|conditioner)\b/i.test(p.name)).length,
      avgPrice: Math.round((all.reduce((s, p) => s + p.price, 0) / (all.length || 1)) * 100) / 100,
      topTypes: [...cats].sort((a, b) => b[1] - a[1]).slice(0, 8),
      topBrands: [...all.reduce((m, p) => m.set(p.brand.trim().toUpperCase(), (m.get(p.brand.trim().toUpperCase()) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 10),
    };
    return NextResponse.json({ us, shops: await pm.competitorStats() });
  }
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
