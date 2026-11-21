import { NextResponse } from "next/server";
import { liveProducts } from "@/lib/pricing";

// Brands on sale now with their product counts, for the mobile menu's A–Z list.
export async function GET() {
  const { list } = await liveProducts();
  const counts = new Map<string, number>();
  for (const p of list) if (p.brand) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
  const brands = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return NextResponse.json({ brands }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
