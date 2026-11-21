import "server-only";

// Server-side catalog queries: grouping variants into cards, filtering, search, facets, paging.

import { getTaxonomy } from "@/lib/catalog";
import { discountPct, type ProductLite, type Tag, type Taxonomy } from "@/lib/data/catalog";
import { shopImg } from "@/lib/img";
import { liveProducts } from "@/lib/pricing";
import { searchProducts } from "@/lib/search";
import type { ProductSource, SearchSettings } from "@/lib/site";
import { getCollections, getSearchSettings } from "@/lib/site-store";

/** One card on a listing = one item, possibly with several sizes/shades. */
export type CardItem = ProductLite & { variantCount: number; priceMax: number };

export function toCards(list: ProductLite[]): CardItem[] {
  const groups = new Map<string, ProductLite[]>();
  for (const p of list) {
    const g = groups.get(p.slug);
    g ? g.push(p) : groups.set(p.slug, [p]);
  }
  const out: CardItem[] = [];
  for (const vs of groups.values()) {
    const live = vs.filter((v) => v.inStock);
    const pool = live.length ? live : vs;
    const rep = pool.reduce((a, b) => (b.price < a.price ? b : a), pool[0]);
    const { source: _src, collections: _cols, ...card } = rep; // which supplier it came from never reaches the browser
    out.push({ ...card, image: shopImg(rep.image ?? vs.find((v) => v.image)?.image), inStock: live.length > 0, variantCount: vs.length, priceMax: Math.max(...vs.map((v) => v.price)) });
  }
  return out;
}

export type ShopQuery = {
  q?: string;
  category?: string;
  collection?: string;
  concern?: string[];
  brand?: string[];
  tag?: string;
  instock?: boolean;
  sale?: boolean;
  min?: number;
  max?: number;
  sort?: "featured" | "price-asc" | "price-desc" | "discount" | "new";
  page?: number;
  perPage?: number;
};

export type ShopResult = {
  items: CardItem[];
  total: number;
  page: number;
  pages: number;
  facets: {
    categories: { slug: string; name: string; count: number }[];
    concerns: { slug: string; name: string; count: number }[];
    brands: { name: string; count: number }[];
  };
  taxonomy: Taxonomy;
  search: Pick<SearchSettings, "filters" | "popular">;
  priceRange: [number, number];
};

export async function queryShop(q: ShopQuery): Promise<ShopResult> {
  const [live, taxonomy, ss] = await Promise.all([liveProducts(), getTaxonomy(), getSearchSettings()]);
  let list = live.list;
  if (q.collection) list = await collectionMembers(q.collection, list);
  if (q.q) {
    list = searchProducts(list, q.q, taxonomy, ss);
    if (ss.outOfStock === "hide") list = list.filter((p) => p.inStock);
  }
  const prices = list.map((p) => p.price);
  const priceRange: [number, number] = prices.length ? [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))] : [0, 0];
  if (q.min !== undefined) list = list.filter((p) => p.price >= q.min!);
  if (q.max !== undefined) list = list.filter((p) => p.price <= q.max!);
  if (q.sale) list = list.filter((p) => (p.compareAt ?? 0) > p.price);

  // Facets are counted on the search result before the facet's own filter is applied,
  // so customers can see how many items each choice would give.
  const byCategory = q.category ? list.filter((p) => p.category === q.category) : list;
  const byConcern = q.concern?.length ? byCategory.filter((p) => q.concern!.some((c) => p.concerns.includes(c))) : byCategory;
  let filtered = q.brand?.length ? byConcern.filter((p) => q.brand!.includes(p.brand)) : byConcern;
  if (q.tag) filtered = filtered.filter((p) => p.tags.includes(q.tag as Tag));

  let cards = toCards(filtered);
  if (q.instock) cards = cards.filter((c) => c.inStock);

  const sort = q.sort ?? ss.defaultSort;
  const oosLast = !q.q || ss.outOfStock !== "show";
  if (sort === "price-asc") cards.sort((a, b) => a.price - b.price);
  else if (sort === "price-desc") cards.sort((a, b) => b.price - a.price);
  else if (sort === "discount") cards.sort((a, b) => (discountPct(b) ?? 0) - (discountPct(a) ?? 0));
  else if (sort === "new") cards.sort((a, b) => Number(b.tags.includes("new")) - Number(a.tags.includes("new")) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  else if (q.q) {
    // Keep search relevance order (cards come out in result order); optionally sink sold-out items.
    if (oosLast) cards.sort((a, b) => Number(b.inStock) - Number(a.inStock));
  } else cards.sort((a, b) => Number(b.inStock) - Number(a.inStock) || Number(b.tags.includes("favorite")) - Number(a.tags.includes("favorite")) || a.name.localeCompare(b.name));

  const perPage = q.perPage ?? ss.perPage;
  const pages = Math.max(1, Math.ceil(cards.length / perPage));
  const page = Math.min(Math.max(1, q.page ?? 1), pages);

  const countBy = <T,>(arr: ProductLite[], key: (p: ProductLite) => T[]) => {
    const m = new Map<T, Set<string>>();
    for (const p of arr) for (const k of key(p)) (m.get(k) ?? m.set(k, new Set()).get(k)!).add(p.slug);
    return m;
  };
  const catCounts = countBy(list, (p) => [p.category]);
  const conCounts = countBy(byCategory, (p) => p.concerns);
  const brandCounts = countBy(byConcern, (p) => [p.brand]);

  return {
    items: cards.slice((page - 1) * perPage, page * perPage),
    total: cards.length,
    page,
    pages,
    facets: {
      categories: taxonomy.categories.map((c) => ({ ...c, count: catCounts.get(c.slug)?.size ?? 0 })).filter((c) => c.count > 0 || c.slug === q.category),
      concerns: taxonomy.concerns.map((c) => ({ slug: c.slug, name: c.name, count: conCounts.get(c.slug)?.size ?? 0 })).filter((c) => c.count > 0 || q.concern?.includes(c.slug)),
      brands: [...brandCounts.entries()].map(([name, s]) => ({ name, count: s.size })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    },
    taxonomy,
    search: { filters: ss.filters, popular: ss.popular },
    priceRange,
  };
}

/** Cards for a homepage section. */
export async function cardsByTag(tag: Tag, limit = 16): Promise<CardItem[]> {
  return cardsFor({ kind: "tag", value: tag }, limit, "discount");
}

export async function liveCards(): Promise<CardItem[]> {
  return toCards((await liveProducts()).list);
}

const listOf = (v: string) => v.split(/[,\n|]/).map((x) => x.trim()).filter(Boolean);

/** Cards for a configurable homepage product row. */
export async function cardsFor(src: ProductSource, limit = 16, sort: "featured" | "price-asc" | "discount" | "new" = "featured"): Promise<CardItem[]> {
  const { list } = await liveProducts();
  const vals = listOf(src.value);
  let pool: ProductLite[];
  switch (src.kind) {
    case "tag": pool = list.filter((p) => p.tags.includes(src.value as Tag)); break;
    case "category": pool = list.filter((p) => vals.includes(p.category)); break;
    case "brand": pool = list.filter((p) => vals.some((b) => b.toLowerCase() === p.brand.toLowerCase())); break;
    case "concern": pool = list.filter((p) => p.concerns.some((c) => vals.includes(c))); break;
    case "search": {
      const [tax, ss] = await Promise.all([getTaxonomy(), getSearchSettings()]);
      pool = searchProducts(list, src.value, tax, ss);
      break;
    }
    case "skus": {
      const order = vals.map((v) => v.toLowerCase());
      pool = list.filter((p) => order.includes(p.sku.toLowerCase()) || order.includes(p.slug)).sort((a, b) => order.indexOf(a.sku.toLowerCase()) - order.indexOf(b.sku.toLowerCase()));
      break;
    }
    case "newest": pool = [...list].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")); break;
    case "sale": pool = list.filter((p) => (p.compareAt ?? 0) > p.price); break;
    case "collection": pool = await collectionMembers(src.value.trim(), list); break;
  }
  let cards = toCards(pool).filter((c) => c.inStock);
  if (src.kind !== "skus" && src.kind !== "search" && src.kind !== "newest") {
    if (sort === "discount") cards.sort((a, b) => (discountPct(b) ?? 0) - (discountPct(a) ?? 0));
    else if (sort === "price-asc") cards.sort((a, b) => a.price - b.price);
    else if (sort === "new") cards.sort((a, b) => Number(b.tags.includes("new")) - Number(a.tags.includes("new")) || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    else cards.sort((a, b) => Number(b.tags.includes("favorite")) - Number(a.tags.includes("favorite")) || (discountPct(b) ?? 0) - (discountPct(a) ?? 0));
  }
  return cards.slice(0, limit);
}

/** Products in a collection: tagged members, plus brand and search rules set in Admin → Collections. */
export async function collectionMembers(key: string, list?: ProductLite[]): Promise<ProductLite[]> {
  const all = list ?? (await liveProducts()).list;
  const [cols, tax, ss] = await Promise.all([getCollections(), getTaxonomy(), getSearchSettings()]);
  const c = cols.items.find((x) => x.key.toLowerCase() === key.toLowerCase());
  const k = key.toLowerCase();
  const members = new Set(all.filter((p) => p.collections?.some((x) => x.toLowerCase() === k)).map((p) => p.id));
  if (c?.brands.length) for (const p of all) if (c.brands.some((b) => b.toLowerCase() === p.brand.toLowerCase())) members.add(p.id);
  if (c?.rule) for (const p of searchProducts(all, c.rule, tax, ss)) members.add(p.id);
  return all.filter((p) => members.has(p.id));
}
