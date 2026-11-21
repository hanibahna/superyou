import "server-only";

// Keeps menus and category links in step with what's actually on sale, for every catalog (current
// or imported later). When a catalog or brand is switched off in Admin → Visibility, a menu section
// stays only if products from the catalogs still on are in it; sections, links and tiles that would
// open an empty page or an empty search disappear, and come back when the catalog is switched on.

import { getIndex } from "@/lib/catalog";
import { slugify, type ProductLite, type Taxonomy } from "@/lib/data/catalog";
import { liveProducts } from "@/lib/pricing";
import { searchProducts } from "@/lib/search";
import type { MenuItem, Settings } from "@/lib/site";
import { getCollections, getSearchSettings } from "@/lib/site-store";
import { getTaxonomy } from "@/lib/catalog";

type LiveNav = { key: string; collections: Set<string>; categories: Set<string>; concerns: Set<string>; brands: Set<string>; knownBrands: Set<string>; brandNames: Map<string, string> };
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
  const brandNames = new Map<string, string>(); // squashed name → brand, for brands on sale
  for (const p of list) brandNames.set(slugify(p.brand).replace(/-/g, ""), p.brand);
  // Brand pages are matched loosely too ("sobio-etic" = "So' Bio Etic").
  for (const b of [...knownBrands]) knownBrands.add(b.replace(/-/g, ""));
  for (const b of [...brands]) brands.add(b.replace(/-/g, ""));
  g.__liveNav = { key, collections, categories, concerns, brands, knownBrands, brandNames };
  return g.__liveNav;
}

/** true = leads to products, false = would be empty, null = not a catalog link (keep it). */
export function hrefIsLive(href: string, nav: LiveNav): boolean | null {
  if (!href || href === "#") return null; // a heading, or a placeholder link
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
    const c = s.replace(/-/g, "");
    return nav.knownBrands.has(s) || nav.knownBrands.has(c) ? nav.brands.has(s) || nav.brands.has(c) : null;
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

const squash = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "").replace(/s$/, "");
/** The automatic category that matches a menu label or tile title ("Skin Care" → Skincare, "Hair Expert" → Hair). */
export function matchCategory(label: string, auto: MenuItem[]): MenuItem | undefined {
  const l = squash(label);
  if (l.length < 3) return undefined;
  return auto.find((a) => squash(a.label) === l) ?? auto.find((a) => { const c = squash(a.label); return c.length >= 4 && (l.startsWith(c) || c.startsWith(l)); });
}

/** Keep every menu entry that leads to products. An entry whose own page would be empty stays as a
 *  heading while anything under it still has products (its link then goes to the matching automatic
 *  category, or nowhere); with nothing left under it, it goes. */
export function pruneMenu(items: MenuItem[], nav: LiveNav, auto: MenuItem[] = []): MenuItem[] {
  const out: MenuItem[] = [];
  for (const it of items) {
    const live = hrefIsLive(it.href, nav);
    const hadChildren = (it.children ?? []).length > 0;
    const children = pruneMenu(it.children ?? [], nav, auto);
    if (live === false) {
      if (!children.length) {
        // A brand entry whose own list is empty, while another catalog still sells that brand: open the brand.
        const brand = !/^view all$/i.test(it.label) && nav.brandNames.get(slugify(it.label).replace(/-/g, ""));
        if (brand) out.push({ ...it, href: `/shop/?brand=${encodeURIComponent(brand)}` });
        continue; // otherwise empty and nothing under it with products
      }
      out.push({ ...it, href: matchCategory(it.label, auto)?.href ?? "#", children });
      continue;
    }
    if (live === null && hadChildren && !children.length) continue; // a heading with nothing left under it
    if ((!it.href || it.href === "#") && !children.length) {
      // A placeholder named after a brand on sale ("Avène", "Durex") opens that brand's products.
      const brand = nav.brandNames.get(slugify(it.label).replace(/-/g, ""));
      if (brand) out.push({ ...it, href: `/shop/?brand=${encodeURIComponent(brand)}` });
      continue;
    }
    out.push({ ...it, children });
  }
  // A lone "View All" left in a group isn't useful.
  return out.length === 1 && /^view all$/i.test(out[0].label) && !out[0].children.length ? [] : out;
}

/** The menu for the shop. When a catalog's sections have all gone (it's switched off), automatic
 *  category links built from the catalogs still on (`auto`) take their place, before what's left. */
export function liveMenu(items: MenuItem[], nav: LiveNav, auto: MenuItem[]): MenuItem[] {
  const pruned = pruneMenu(items, nav, auto);
  const isCatalog = (x: MenuItem) => /\/collections\/|[?&]category=/.test(x.href);
  const anyLive = (xs: MenuItem[]): boolean => xs.some((x) => (isCatalog(x) && hrefIsLive(x.href, nav) === true) || anyLive(x.children ?? []));
  const hadSections = items.some(isCatalog);
  // Only when nothing at all is left from the catalog's menu do the automatic categories take over.
  if (hadSections && !anyLive(pruned)) {
    const labels = new Set(pruned.map((x) => x.label.toLowerCase()));
    return [...auto.filter((a) => !labels.has(a.label.toLowerCase())), ...pruned];
  }
  return pruned;
}

/** Footer links and homepage tiles: an empty one points to the matching automatic category, or goes. */
export function pruneLinks<T extends { href: string; label?: string; title?: string }>(links: T[], nav: LiveNav, auto: MenuItem[] = []): T[] {
  return links.flatMap((l) => {
    if (hrefIsLive(l.href, nav) !== false) return [l];
    const m = matchCategory(l.label ?? l.title ?? "", auto);
    return m ? [{ ...l, href: m.href }] : [];
  });
}

/** Automatic category links from the catalogs that are on. */
export const autoCategories = (tax: Taxonomy, nav: LiveNav): MenuItem[] =>
  tax.categories.filter((c) => c.menu !== false && nav.categories.has(c.slug)).map((c) => ({ label: c.name, href: `/shop/?category=${c.slug}`, children: [] }));

/** For buttons and banners: an empty category is swapped for the sale page or the whole shop. */
export function liveHref(href: string, nav: LiveNav): string {
  if (hrefIsLive(href, nav) !== false) return href;
  return /deal|offer|sale|black|friday|promo|discount/i.test(href) ? "/shop/?sale=1" : "/shop/";
}

/** Same, for every link field (href, href2, link…) inside homepage sections. */
export function liveHrefsDeep<T>(v: T, nav: LiveNav): T {
  if (Array.isArray(v)) return v.map((x) => liveHrefsDeep(x, nav)) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = typeof x === "string" && /^(href\d*|link)$/.test(k) ? liveHref(x, nav) : liveHrefsDeep(x, nav);
    return out as T;
  }
  return v;
}

/** Menus, footer links and announcement for the shop, trimmed to what's on sale right now. */
export function shopNav(s: Settings, nav: LiveNav, tax: Taxonomy) {
  const auto = autoCategories(tax, nav);
  return {
    menu: liveMenu(s.menu, nav, auto),
    footerMenu: s.footerMenu.map((c) => ({ ...c, links: pruneLinks(c.links, nav, auto) })).filter((c) => c.links.length),
    announcement: liveHrefsDeep(s.announcement, nav),
  };
}
