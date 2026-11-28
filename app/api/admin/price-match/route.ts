import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-auth";

export const maxDuration = 300;

/** Last price check: shops read, products matched, prices matched and items flagged. */
export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const u = new URL(req.url);
  const pm0 = await import("@/lib/price-match");
  if (u.searchParams.has("review")) return NextResponse.json({ items: await pm0.reviewList() });
  if (u.searchParams.has("diag")) {
    // What shoppers see now, product by product: on SuperPrice, "lowest" claim, hidden (and why), or no data.
    const { liveProducts } = await import("@/lib/pricing");
    const { getMargins, floorPrice } = await import("@/lib/margins");
    const live = await liveProducts();
    const pm = await pm0.priceMatches();
    const margins = await getMargins();
    const out = { visible: live.list.length, superPrice: 0, claim: 0, hidden: 0, noData: 0, hiddenNight: 0, hiddenFloor: 0, hiddenSale: 0, samples: [] as unknown[] };
    for (const p of live.list) {
      const x = p as typeof p & { matchWas?: number; cmpVs?: number; pmLose?: boolean };
      if (x.matchWas) out.superPrice++;
      else if (x.cmpVs) out.claim++;
      else if (x.pmLose) {
        out.hidden++;
        const m = pm.map.get(p.id), c = pm.cmp.get(p.id);
        if (c?.lose) out.hiddenNight++;
        else if (m) { const f = floorPrice(p, margins); if (f !== undefined && f >= m.p) out.hiddenFloor++; else out.hiddenSale++; }
        if (out.samples.length < 8) out.samples.push({ name: `${p.brand} ${p.name}`, price: p.price, cost: p.cost, m: m && { p: m.p, t: m.t, s: m.s }, c: c && { t: c.t, s: c.s, lose: c.lose }, floor: floorPrice(p, margins) });
      } else out.noData++;
    }
    return NextResponse.json(out);
  }
  if (u.searchParams.has("coverage")) return NextResponse.json(await pm0.coverage());
  if (u.searchParams.get("product")) return NextResponse.json({ recs: await pm0.productRecs(u.searchParams.get("product")!) });
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
  // Call ourselves on the address this request came in on: going through shopsuperyou.com would
  // redirect to www and the redirect drops the Authorization header, so the next step was refused.
  const self = new URL(req.url).origin;
  const denied = await adminGuard();
  if (denied) return denied;
  const secret = process.env.CRON_SECRET;
  // A run that stopped half-way (state still there) is continued instead of restarted.
  const { running } = await (await import("@/lib/price-match")).getReport();
  const body = (await req.json().catch(() => ({}))) as { resume?: boolean; sync?: boolean; decide?: { key: string; ok: boolean } };
  // Confirm or reject a suggested match (used from the next price check).
  if (body.decide?.key && /^[^|]+\|[a-z0-9.-]+\|\d+$/i.test(body.decide.key)) {
    await (await import("@/lib/price-match")).decide(body.decide.key, !!body.decide.ok);
    return NextResponse.json({ ok: true });
  }
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
  await (async () => fetch(`${self}/api/cron/price-match/${resume ? "?hop=1" : ""}`, { headers: secret ? { authorization: `Bearer ${secret}` } : {}, cache: "no-store" }).catch((e) => console.error("[price-match start]", e)))();
  return NextResponse.json({ ok: true });
}
