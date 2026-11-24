import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { liveProducts } from "@/lib/pricing";

// Suggests free-gift samples: minis and travel sizes in stock, spread across categories and brands.
export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const n = Math.min(60, Number(req.nextUrl.searchParams.get("n") ?? 24) || 24);
  const max = Number(req.nextUrl.searchParams.get("max") ?? 15) || 15;
  const small = (s: string) => {
    const m = s.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s?(ml|g)\b/);
    return m ? parseFloat(m[1].replace(",", ".")) <= 30 : false;
  };
  const cands = (await liveProducts()).list.filter((p) => p.inStock && p.price > 0 && p.price <= max && p.image && (/\b(mini|travel|sample|deluxe)\b/i.test(`${p.name} ${p.variant ?? ""}`) || small(`${p.name} ${p.variant ?? ""} ${p.size ?? ""}`)));
  const byCat = new Map<string, typeof cands>();
  for (const p of cands.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0))) (byCat.get(p.category) ?? byCat.set(p.category, []).get(p.category)!).push(p);
  const out: typeof cands = [];
  const brands = new Set<string>();
  // Round-robin over categories, one per brand, so the choice is varied.
  for (let round = 0; out.length < n && round < 50; round++)
    for (const list of byCat.values()) {
      const p = list.find((x) => !brands.has(x.brand) && !out.includes(x));
      if (p && out.length < n) (out.push(p), brands.add(p.brand));
    }
  return NextResponse.json({ total: cands.length, picks: out.map((p) => ({ sku: p.sku, name: `${p.brand} ${p.name}${p.variant ? ` · ${p.variant}` : ""}`, price: p.price, category: p.category })) });
}
