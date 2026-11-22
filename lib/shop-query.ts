import "server-only";

import type { ShopQuery } from "@/lib/listing";
import { getVideoLibrary } from "@/lib/site-store";

export type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const many = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function parseQuery(sp: SP): ShopQuery {
  return {
    q: one(sp.q)?.slice(0, 100),
    category: one(sp.category),
    concern: many(sp.concern),
    brand: many(sp.brand),
    tag: one(sp.tag),
    instock: one(sp.instock) === "1",
    sale: one(sp.sale) === "1",
    origin: one(sp.origin) === "international" || one(sp.origin) === "local" ? (one(sp.origin) as "local" | "international") : undefined,
    min: one(sp.min) ? Number(one(sp.min)) || undefined : undefined,
    max: one(sp.max) ? Number(one(sp.max)) || undefined : undefined,
    sort: one(sp.sort) as ShopQuery["sort"],
    page: Number(one(sp.page) ?? 1) || 1,
    collection: one(sp.collection),
  };
}

export async function videosFor(query: ShopQuery) {
  const lib = await getVideoLibrary();
  const brand = query.brand?.length === 1 ? query.brand[0] : undefined;
  return lib.items.filter((v) => v.enabled && (
    (query.category && lib.show.category && v.categories.includes(query.category)) ||
    (brand && lib.show.brand && v.brands.some((b) => b.toLowerCase() === brand.toLowerCase())) ||
    (query.q && lib.show.search && v.title.toLowerCase().includes(query.q.toLowerCase()))
  )).slice(0, 12);
}

