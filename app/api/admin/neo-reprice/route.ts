import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getIndex, getProductsDetailed, saveProducts } from "@/lib/catalog";
import { discountFor } from "@/lib/costs/neovitale";
import { db } from "@/lib/db-core";

export const maxDuration = 300;

// NeoVitale catalog: sell at NeoVitale's regular price, cost = regular price × (1 − brand discount).
// Regular price = their crossed-out price when on sale, otherwise their price. Their sale prices are
// not copied, so no strike-through price and no sale badges from them. Uses the prices read by
// /api/admin/neo-audit (product-page checks first, then the catalog feed).
// GET = preview; GET ?apply=1 = save.
export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const apply = req.nextUrl.searchParams.has("apply");
  const feed = JSON.parse((await db.cmd<string | null>(["GET", "neo-audit:live"])) ?? "{}") as Record<string, [number, number, number]>;
  const page = JSON.parse((await db.cmd<string | null>(["GET", "neo-audit:verified"])) ?? "{}") as Record<string, [number, number, number]>;
  if (!Object.keys(feed).length) return NextResponse.json({ error: "Run /api/admin/neo-audit first to read NeoVitale's prices." }, { status: 409 });
  const idx = await getIndex();
  const neo = idx.all.filter((p) => p.source === "neovitale.com");
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const plan = new Map<string, { price: number; cost?: number }>();
  let priceUp = 0, priceDown = 0, costChanged = 0, wasRemoved = 0, notFound = 0, noDiscount = 0;
  const sample: string[] = [];
  for (const p of neo) {
    const vid = (p.sku ?? "").split("-").pop() ?? "";
    const nv = page[vid] ?? feed[vid];
    if (!nv) { notFound++; continue; }
    const base = r2(nv[1] > nv[0] ? nv[1] : nv[0]);
    if (!(base > 0)) continue;
    const pct = discountFor(p.brand, p.name);
    const cost = typeof pct === "number" ? r2(base * (1 - pct / 100)) : undefined;
    if (cost === undefined) noDiscount++;
    const costDiff = cost !== undefined && Math.abs((p.cost ?? -1) - cost) > 0.005;
    if (!(Math.abs(p.price - base) > 0.005 || !!p.compareAt || costDiff)) continue;
    if (base > p.price + 0.005) priceUp++; else if (base < p.price - 0.005) priceDown++;
    if (p.compareAt) wasRemoved++;
    if (costDiff) costChanged++;
    plan.set(p.id, { price: base, cost });
    if (sample.length < 15 && Math.abs(base - p.price) > 0.005) sample.push(`${p.brand} | ${p.name}${p.variant ? ` · ${p.variant}` : ""} | $${p.price} → $${base}${cost !== undefined ? ` | cost $${cost}` : ""}`);
  }
  if (apply) {
    const ids = [...plan.keys()];
    const SALE_TAGS = new Set(["mega", "half", "deal"]);
    for (let i = 0; i < ids.length; i += 400) {
      const part = await getProductsDetailed(ids.slice(i, i + 400));
      await saveProducts(part.map((p) => {
        const c = plan.get(p.id)!;
        return { ...p, price: c.price, compareAt: undefined, ...(c.cost !== undefined ? { cost: c.cost } : {}), tags: (p.tags ?? []).filter((t) => !SALE_TAGS.has(t)) };
      }));
    }
  }
  return NextResponse.json({ applied: apply, neovitaleProducts: neo.length, checkedOnProductPage: Object.keys(page).length, toChange: plan.size, priceUp, priceDown, wasRemoved, costChanged, noDiscountOnSheet: noDiscount, notFound, sample });
}
