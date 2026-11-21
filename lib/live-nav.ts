import "server-only";

// Keeps menus and category links in step with what's actually on sale. When a catalog source
// (e.g. Skin Society) or a brand is switched off in Admin → Visibility, every menu entry,
// footer link and homepage tile that would lead to an empty page disappears, and comes back
// as soon as it's switched on again. Links that aren't to a collection or category stay as they are.

import { getIndex } from "@/lib/catalog";
import { slugify, type ProductLite } from "@/lib/data/catalog";
import { liveProducts } from "@/lib/pricing";
import { searchProducts } from "@/lib/search";
import type { MenuItem } from "@/lib/site";
import { getCollections, getSearchSettings } from "@/lib/site-store";
import { getTaxonomy } from "@/lib/catalog";

type LiveNav = { key: string; collections: Set<string>; categories: Set<string>; concerns: Set<string>; brands: Set<string>; knownBrands: Set<string> };
const g = globalThis as unknown as { __liveNav?: LiveNav };

export async function liveNav(): Promise<LiveNav> {
  const [live, cols, idx] = await Promise.all([liveProducts(), getCollections(), getIndex()]);
  const key = `${live.key}|${JSON.stringify(cols.items.map((c) => [c.key, c.hidden, c.brands, c.rule]))}`;
  if (g.__liveNav?.key === key) return g.__liveNav;
  const list: ProductLite[] = live.list;
  const collections = new Set<string>();
  const categories = new Set<string>();
  const concerns = new Set<string>();
  const brands = new Set<string>();
  for (const p of list) {
    for (const c of p.collections ?? []) collections.add(c.toLowerCase());
    categories.add(p.category);
    for (const c of p.concerns) concerns.add(c);
    brands.add(slugify(p.brand));
  }
  const ruled = cols.items.filter((c) => !c.hidden && (c.brands.length || c.rule));
  if (ruled.length) {
    const [tax, ss] = await Promise.all([getTaxonomy(), getSearchSettings()]);
    for (const c of ruled) {
      const k = c.key.toLowerCase();
      if (collections.has(k)) continue;
      if (c.brands.some((b) => brands.has(slugify(b))) || (c.rule && searchProducts(list, c.rule, tax, ss).length)) collections.add(k);
    }
  }
  for (const c of cols.items) if (c.hidden) collections.delete(c.key.toLowerCase());
  const knownBrands = new Set(idx.all.map((p) => slugify(p.brand)));
  g.__liveNav = { key, collections, categories, concerns, brands, knownBrands };
  return g.__liveNav;
}

/** true = leads to products, false = would be empty, null = not a catalog link (keep it). */
export function hrefIsLive(href: string, nav: LiveNav): boolean | null {
  if (!href || href === "#") return null;
  let u: URL;
  try {
    u = new URL(href, "https://x.invalid");
  } catch {
    return null;
  }
  if (u.origin !== "https://x.invalid") return null; // another website
  const path = u.pathname.replace(/^\/(ar|fr)(?=\/)/, "");
  const col = path.match(/^\/collections\/(.+?)\/?$/);
  if (col) return nav.collections.has(decodeURIComponent(col[1]).toLowerCase());
  const page = path.match(/^\/pages\/([^/]+)\/?$/);
  if (page) {
    // Brand pages (/pages/la-roche-posay/): hide when that brand has nothing on sale.
    const s = page[1].toLowerCase();
    return nav.knownBrands.has(s) ? nav.brands.has(s) : null;
  }
  if (path === "/shop" || path === "/shop/") {
    const cat = u.searchParams.get("category");
    const brand = u.searchParams.get("brand");
    if (cat && !nav.categories.has(cat)) return false;
    if (brand && nav.knownBrands.has(slugify(brand)) && !nav.brands.has(slugify(brand))) return false;
    return cat || brand ? true : null;
  }
  return null;
}

/** Drop menu entries that lead nowhere; a heading stays while any of its entries is left. */
export function pruneMenu(items: MenuItem[], nav: LiveNav): MenuItem[] {
  const out: MenuItem[] = [];
  for (const it of items) {
    const children = pruneMenu(it.children ?? [], nav);
    const live = hrefIsLive(it.href, nav);
    const hadChildren = (it.children ?? []).length > 0;
    if (live === false && !children.length) continue; // empty collection, nothing under it
    if (live === null && hadChildren && !children.length && (!it.href || it.href === "#")) continue; // empty heading
    // "View All" under a heading whose collection is empty: already dropped above.
    out.push({ ...it, children });
  }
  // A lone "View All" left in a group isn't useful.
  return out.length === 1 && /^view all$/i.test(out[0].label) && !out[0].children.length ? [] : out;
}

export function pruneLinks<T extends { href: string }>(links: T[], nav: LiveNav): T[] {
  return links.filter((l) => hrefIsLive(l.href, nav) !== false);
}
