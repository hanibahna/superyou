import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getTaxonomy } from "@/lib/catalog";
import { finderById } from "@/lib/finders";
import { toCards } from "@/lib/listing";
import { liveProducts } from "@/lib/pricing";
import { searchProducts } from "@/lib/search";
import { getSearchSettings } from "@/lib/site-store";

// Section finder quizzes: each answer's words are searched in the section's category; products
// that match more answers rank higher, best rated first on ties.
export async function POST(req: NextRequest) {
  const p = z.object({ id: z.string().max(40), answers: z.array(z.number().int().min(0).max(20)).max(10) }).safeParse(await req.json().catch(() => null));
  const f = p.success ? finderById(p.data.id) : undefined;
  if (!p.success || !f) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [live, tax, settings] = await Promise.all([liveProducts(), getTaxonomy(), getSearchSettings()]);
  const pool = toCards(live.list.filter((x) => x.status !== "draft" && x.inStock && x.category === f.category));
  const loose = { ...settings, typoTolerance: true };
  const score = new Map<string, number>();
  const words = p.data.answers.map((a, i) => f.questions[i]?.options[a]?.q ?? "").filter(Boolean);
  for (const w of words) {
    // Every word of an answer is tried alone too, so "oil free matte" still finds "matte".
    const hits = new Set(searchProducts(pool, `${f.base} ${w}`.trim(), tax, loose).map((x) => x.slug));
    for (const one of w.split(/\s+/)) for (const x of searchProducts(pool, `${f.base} ${one}`.trim(), tax, loose)) hits.add(x.slug);
    for (const s of hits) score.set(s, (score.get(s) ?? 0) + 1);
  }
  const ranked = pool
    .map((c) => ({ c, s: score.get(c.slug) ?? 0 }))
    .filter((x) => x.s > 0 || !words.length)
    .sort((a, b) => b.s - a.s || (b.c.rating ?? 0) * (b.c.reviewCount ?? 0) - (a.c.rating ?? 0) * (a.c.reviewCount ?? 0))
    .slice(0, 8)
    .map((x) => x.c);
  const fallback = ranked.length ? [] : pool.slice(0, 8);
  return NextResponse.json({ products: ranked.length ? ranked : fallback, exact: ranked.length > 0 });
}
