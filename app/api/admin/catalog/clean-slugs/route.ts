import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const maxDuration = 300;

// One-off: web addresses ending in "-sks-<number>" (a supplier's group code) become clean ones:
// the plain name, or name-2, name-3 on a clash. Old addresses redirect permanently, and the
// reviews, pinned videos, how-to guides and videos stored under the old address move with it.
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const dry = req.nextUrl.searchParams.has("dry");
  const { getAllProducts, getProductsDetailed, saveProducts } = await import("@/lib/catalog");
  const all = await getAllProducts();
  const taken = new Set(all.map((p) => p.slug));
  const bad = [...new Set(all.map((p) => p.slug).filter((s) => /-sks-\d+$/.test(s)))];
  const moves: [string, string][] = [];
  const { slugify } = await import();
  const brandOf = new Map(all.map((p) => [p.slug, p.brand]));
  for (const old of bad) {
    const name = old.replace(/-sks-\d+$/, "");
    const b = slugify(brandOf.get(old) ?? "");
    // Prefer the brand in front (clear and good for search), else -2, -3…
    const base = b && !name.startsWith(b) ? `${b}-${name}` : name;
    let next = base;
    for (let n = 2; taken.has(next); n++) next = `${base}-${n}`;
    taken.add(next);
    moves.push([old, next]);
  }
  if (dry) return NextResponse.json({ count: moves.length, sample: moves.slice(0, 15) });
  const map = new Map(moves);
  // 1. Products
  const ids = all.filter((p) => map.has(p.slug)).map((p) => p.id);
  for (let i = 0; i < ids.length; i += 300) {
    const list = await getProductsDetailed(ids.slice(i, i + 300));
    await saveProducts(list.map((p) => ({ ...p, slug: map.get(p.slug) ?? p.slug })));
  }
  // 2. Redirects, and everything stored under the old address
  const { getExtras, saveExtras } = await import("@/lib/extras");
  const ex = await getExtras();
  let reviews = 0;
  for (const [old, next] of moves) {
    await db.cmd(["HSET", "slugmove", old, next]);
    for (const k of ["guide:v2:", "yt:v6:"]) await db.cmd(["RENAME", `${k}${old}`, `${k}${next}`]).catch(() => {});
    const rv = await db.cmd<string[]>(["HGETALL", `rv:${old}`]).catch(() => [] as string[]);
    for (let i = 0; i + 1 < (rv?.length ?? 0); i += 2) {
      const r = JSON.parse(rv[i + 1]);
      const score = await db.cmd<string | null>(["ZSCORE", "rv:all", `${old}|${rv[i]}`]).catch(() => null);
      await db.pipeline([["HSET", `rv:${next}`, rv[i], JSON.stringify({ ...r, slug: next })], ["ZREM", "rv:all", `${old}|${rv[i]}`], ["ZADD", "rv:all", score ?? String(Date.now()), `${next}|${rv[i]}`]]);
      reviews++;
    }
    if (rv?.length) await db.cmd(["DEL", `rv:${old}`]);
    if (ex.youtube.pins[old]) { ex.youtube.pins[next] = ex.youtube.pins[old]; delete ex.youtube.pins[old]; }
  }
  await saveExtras(ex);
  return NextResponse.json({ moved: moves.length, products: ids.length, reviews });
}
