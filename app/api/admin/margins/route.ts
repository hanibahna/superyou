import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard, currentAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-session";
import { getMargins, saveMargins } from "@/lib/margins";
import { marginRows } from "@/lib/margins-report";
import { getIndex, getProductsDetailed, saveProducts } from "@/lib/catalog";
import { discountFor, normBrand } from "@/lib/costs/neovitale";

export const maxDuration = 300;

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  return NextResponse.json({ margins: await getMargins(), rows: await marginRows() });
}

const schema = z.object({
  floorPct: z.number().min(0).max(90),
  brandFloors: z.record(z.string().max(120), z.number().min(0).max(90)),
  neoRates: z.record(z.string().max(120), z.number().min(0).max(90).nullable()),
  subPct: z.record(z.string().max(120), z.number().min(0).max(50)).default({}),
});

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the percentages (0–90%)." }, { status: 400 });
  const before = await getMargins();
  const next = { floorPct: parsed.data.floorPct, brandFloors: Object.fromEntries(Object.entries(parsed.data.brandFloors).map(([k, v]) => [k.toLowerCase(), v])), neoRates: parsed.data.neoRates, subPct: Object.fromEntries(Object.entries(parsed.data.subPct).map(([k, v]) => [k.toLowerCase(), v])) };
  await saveMargins(next);
  // Brands whose NeoVitale rate changed: recompute their cost (cost = our regular price × (1 − rate)).
  const changed = new Set([...Object.keys(before.neoRates), ...Object.keys(next.neoRates)].filter((k) => before.neoRates[k] !== next.neoRates[k]).map(normBrand));
  let costsUpdated = 0;
  if (changed.size) {
    const idx = await getIndex();
    const ids = idx.all.filter((p) => p.source === "neovitale.com" && changed.has(normBrand(p.brand))).map((p) => p.id);
    for (let i = 0; i < ids.length; i += 400) {
      const part = await getProductsDetailed(ids.slice(i, i + 400));
      await saveProducts(part.map((p) => {
        const r = discountFor(p.brand, p.name);
        costsUpdated++;
        return { ...p, cost: typeof r === "number" && p.price > 0 ? Math.round(p.price * (1 - r / 100) * 100) / 100 : undefined };
      }));
    }
  }
  const me = await currentAdmin();
  await audit(me?.name ?? "admin", `Margins: floor ${next.floorPct}%, ${Object.keys(next.brandFloors).length} brand floors, ${Object.keys(next.neoRates).length} NeoVitale rates edited, ${Object.keys(next.subPct).length} auto-replenish rates`).catch(() => {});
  return NextResponse.json({ ok: true, costsUpdated });
}
