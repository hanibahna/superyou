import "server-only";

// Keeps menus and category links in step with what's actually on sale, for every catalog (current
// or imported later). When a catalog or brand is switched off in Admin → Visibility, a menu section
// stays only if products from the catalogs still on are in it; sections, links and tiles that would
// open an empty page or an empty search disappear, and come back when the catalog is switched on.

import { getIndex } from "@/lib/catalog";
import { BABY_GROUPS } from "@/lib/baby";
import { slugify, type ProductLite, type Taxonomy } from "@/lib/data/catalog";
import { liveProducts } from "@/lib/pricing";
import { searchProducts } from "@/lib/search";
import type { MenuItem, Settings } from "@/lib/site";
import { getCollections, getSearchSettings } from "@/lib/site-store";
import { getTaxonomy } from "@/lib/catalog";

type LiveNav = {
  key: string; collections: Set<string>; categories: Set<string>; concerns: Set<string>; brands: Set<string>; knownBrands: Set<string>; brandNames: Map<string, string>;
  /** Which product categories each collection / brand has on sale (so "Caudalie" under Fragrances counts only Caudalie fragrances). */
  colCats: Map<string, Set<string>>; brandCats: Map<string, Set<string>>;
  /** Categories with products on sale from local stock / imported catalogs ("Imported from the USA" links). */
  originCats: Map<string, Set<string>>;
  /** Every category, on sale or not, to tell which category a menu section is about. */
  allCats: { slug: string; name: string }[];
  /** Baby & Mom sections that have products, and its biggest brands. */
  babySubs: string[]; babyBrands: string[];
};
const g = globalThis as unknown as { __liveNav?: LiveNav };

export async function liveNav(): Promise<LiveNav> {
  const [live, cols, idx] = await Promise.all([liveProducts(), getCollections(), getIndex()]);
  const key = `${live.key}|${JSON.stringify(cols.items.map((c) => [c.key, c.hidden, c.brands, c.rule]))}`;
  if (g.__liveNav?.key === key) return g.__liveNav;
  const list: ProductLite[] = live.list;
  const colCats = new Map<string, Set<string>>();
  const brandCats = new Map<string, Set<string>>();
  const originCats = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, k: string, c: string) => (m.get(k) ?? m.set(k, new Set()).get(k)!).add(c);
  const collections = new Set<string>();
  const categories = new Set<string>();
  const concerns = new Set<string>();
  const brands = new Set<string>();
  for (const p of list) {
    for (const c of p.collections ?? []) (collections.add(c.toLowerCase()), add(colCats, c.toLowerCase(), p.category));
    add(brandCats, slugify(p.brand).replace(/-/g, ""), p.category);
    categories.add(p.category);
    add(originCats, p.origin ?? "local", p.category);
    if (p.origin === "international" && p.shipFrom) add(originCats, `from:${p.shipFrom.toLowerCase()}`, p.category);
    for (const c of p.concerns) concerns.add(c);
    brands.add(slugify(p.brand));
  }
  const ruled = cols.items.filter((c) => !c.hidden && (c.brands.length || c.rule));
  const [tax, ss] = await Promise.all([getTaxonomy(), getSearchSettings()]);
  for (const c of ruled) {
    const k = c.key.toLowerCase();
    // Products a brand or search rule adds (counted with their categories too).
    const ruleBrands = new Set(c.brands.map((b) => slugify(b)));
    const extra = [...(ruleBrands.size ? list.filter((p) => ruleBrands.has(slugify(p.brand))) : []), ...(c.rule ? searchProducts(list, c.rule, tax, ss) : [])];
    for (const p of extra) (collections.add(k), add(colCats, k, p.category));
  }
  for (const c of cols.items) if (c.hidden) collections.delete(c.key.toLowerCase());
  const knownBrands = new Set(idx.all.map((p) => slugify(p.brand)));
  const brandNames = new Map<string, string>(); // squashed name → brand, for brands on sale
  for (const p of list) brandNames.set(slugify(p.brand).replace(/-/g, ""), p.brand);
  // Brand pages are matched loosely too ("sobio-etic" = "So' Bio Etic").
  for (const b of [...knownBrands]) knownBrands.add(b.replace(/-/g, ""));
  for (const b of [...brands]) brands.add(b.replace(/-/g, ""));
  const allCats = tax.categories.map((c) => ({ slug: c.slug, name: c.name }));
  const baby = list.filter((p) => p.category === "baby");
  const babySubs = BABY_GROUPS.filter((b) => baby.filter((p) => b.re.test(p.name)).length >= 2).map((b) => b.slug);
  const bc = new Map<string, number>();
  for (const p of baby) bc.set(p.brand, (bc.get(p.brand) ?? 0) + 1);
  const babyBrands = [...bc].filter(([b, n]) => n >= 2 && b !== "SuperYou").sort((a, b) => b[1] - a[1]).slice(0, 8).map(([b]) => b);
  g.__liveNav = { key, collections, categories, concerns, brands, knownBrands, brandNames, colCats, brandCats, originCats, allCats, babySubs, babyBrands };
  return g.__liveNav;
}

/** The categories a link's products are in (null = not a catalog link). */
function hrefCats(href: string, nav: LiveNav): Set<string> | null {
  if (!href || href === "#") return null;
  let u: URL;
  try {
    u = new URL(href, "https://x.invalid");
  } catch {
    return null;
  }
  if (u.origin !== "https://x.invalid") return null; // another website
  const path = u.pathname.replace(/^\/(ar|fr)(?=\/)/, "");
  const empty = new Set<string>();
  // The AI skin scan only works once its key is set; until then links to it are left out.
  if (/^\/skin-scan\/?$/.test(path)) return process.env.ANTHROPIC_API_KEY ? null : empty;
  const col = path.match(/^\/collections\/(.+?)\/?$/);
  if (col) {
    const k = decodeURIComponent(col[1]).toLowerCase();
    return nav.collections.has(k) ? (nav.colCats.get(k) ?? empty) : empty;
  }
  const page = path.match(/^\/pages\/([^/]+)\/?$/);
  if (page) {
    // Brand pages (/pages/la-roche-posay/) show that brand's products.
    const c = page[1].toLowerCase().replace(/-/g, "");
    return nav.knownBrands.has(c) || nav.knownBrands.has(page[1].toLowerCase()) ? (nav.brandCats.get(c) ?? empty) : null;
  }
  if (path === "/shop" || path === "/shop/") {
    const cat = u.searchParams.get("category");
    const brand = u.searchParams.get("brand");
    const origin = u.searchParams.get("origin");
    if (!cat && !brand && !origin) return null;
    let cats = brand ? (nav.brandCats.get(slugify(brand).replace(/-/g, "")) ?? empty) : new Set(nav.categories);
    if (cat) cats = new Set([...cats].filter((c) => c === cat));
    // "Imported from the USA" and similar: only while an imported catalog is switched on.
    if (origin) cats = new Set([...cats].filter((c) => nav.originCats.get(origin)?.has(c)));
    return cats;
  }
  return null;
}

/** true = leads to products (in the section's category, when given), false = would be empty, null = not a catalog link. */
export function hrefIsLive(href: string, nav: LiveNav, scope?: string): boolean | null {
  const cats = hrefCats(href, nav);
  if (cats === null) return null;
  return scope ? cats.has(scope) : cats.size > 0;
}

const squash = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "").replace(/s$/, "");
/** The automatic category that matches a menu label or tile title ("Skin Care" → Skincare, "Hair Expert" → Hair). */
export function matchCategory(label: string, auto: MenuItem[]): MenuItem | undefined {
  const l = squash(label);
  if (l.length < 3) return undefined;
  return auto.find((a) => squash(a.label) === l) ?? auto.find((a) => { const c = squash(a.label); return c.length >= 4 && (l.startsWith(c) || c.startsWith(l)); });
}

/** The category a menu section is about ("Fragrances" → fragrance), if its name says so. */
function sectionCategory(label: string, nav: LiveNav): string | undefined {
  const m = matchCategory(label, nav.allCats.map((c) => ({ label: c.name, href: c.slug, children: [] })));
  return m?.href;
}

/** Keep a menu entry only when it leads to products, counting only products in its section's
 *  category (so "Caudalie" under Fragrances needs Caudalie fragrances). An entry whose own page is
 *  empty stays as a heading while anything under it has products; a top section with no entries
 *  left opens its category when that has products, otherwise it goes. */
export function pruneMenu(items: MenuItem[], nav: LiveNav, auto: MenuItem[] = [], scope?: string): MenuItem[] {
  const out: MenuItem[] = [];
  const brandLink = (label: string) => {
    if (/^view all$/i.test(label)) return null;
    const brand = nav.brandNames.get(slugify(label).replace(/-/g, ""));
    if (!brand) return null;
    const href = `/shop/?brand=${encodeURIComponent(brand)}${scope ? `&category=${scope}` : ""}`;
    return hrefIsLive(href, nav, scope) ? href : null;
  };
  for (const it of items) {
    const sc = sectionCategory(it.label, nav) ?? scope;
    const live = hrefIsLive(it.href, nav, sc);
    const hadChildren = (it.children ?? []).length > 0;
    const children = pruneMenu(it.children ?? [], nav, auto, sc);
    if (live === false) {
      const cat = matchCategory(it.label, auto); // the matching category, if it has products
      if (!children.length) {
        // Its own list has nothing here, but the brand (or the category) still does.
        const href = brandLink(it.label) ?? (hadChildren && cat && hrefIsLive(cat.href, nav, sc) ? cat.href : null);
        if (href) out.push({ ...it, href, children: [] });
        continue;
      }
      out.push({ ...it, href: cat && hrefIsLive(cat.href, nav, sc) ? cat.href : "#", children });
      continue;
    }
    if (live === null && hadChildren && !children.length) continue; // a heading with nothing left under it
    if ((!it.href || it.href === "#") && !children.length) {
      // A placeholder named after a brand on sale ("Avène", "Durex") opens that brand's products.
      const href = brandLink(it.label);
      if (href) out.push({ ...it, href });
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
export function shopNav(s: Settings, nav: LiveNav, tax: Taxonomy, wholesale = false) {
  const auto = autoCategories(tax, nav);
  return {
    // Wholesale: always in the menu (after the shop sections), unless the admin menu already has it.
    menu: ((m) => (!wholesale ? m.filter((x) => !x.href.startsWith("/wholesale")) : m.some((x) => x.href.startsWith("/wholesale")) ? m : [...m, { label: "Wholesale", href: "/wholesale/", children: [] }]))(liveMenu(babyMom(s.menu, nav), nav, auto)),
    footerMenu: s.footerMenu.map((c) => ({ ...c, links: pruneLinks(c.links, nav, auto) })).filter((c) => c.links.length),
    announcement: liveHrefsDeep(s.announcement, nav),
  };
}

/** "Body & Baby" in the main menu becomes "Baby & Mom", holding every baby, kids and pregnancy/nursing
 *  product (sections + top brands). Body products stay reachable under Skin Care → Body & Bath. */
export function babyMom(menu: MenuItem[], nav: LiveNav): MenuItem[] {
  const isGroup = (x: MenuItem) => /^\s*body\s*(&|and)\s*baby\s*$/i.test(x.label) || /^\s*(baby|mother|mom)\s*(&|and)\s*(mom|mum|mother|baby|child)\s*$/i.test(x.label);
  // No "Women" / "Men" entries in the main menu (the shop's own filter still offers them).
  const base = menu.filter((x) => !/^\s*(women|men)\s*$/i.test(x.label) && !/[?&]for=(women|men)\b/i.test(x.href));
  const i = base.findIndex(isGroup);
  const hadBody = i >= 0 && /body/i.test(base[i].label);
  const item: MenuItem = {
    label: "Baby & Mom",
    href: "/shop/?category=baby",
    children: [
      { label: "Shop by need", href: "#", children: [
        ...BABY_GROUPS.filter((b) => nav.babySubs.includes(b.slug)).map((b) => ({ label: b.label, href: `/shop/?category=baby&sub=${b.slug}`, children: [] })),
        { label: "View All", href: "/shop/?category=baby", children: [] },
      ] },
      ...(nav.babyBrands.length ? [{ label: "Top Brands", href: "#", children: nav.babyBrands.map((b) => ({ label: b, href: `/shop/?brand=${encodeURIComponent(b)}&category=baby`, children: [] })) }] : []),
    ],
  };
  // Drop any other Baby & Mom entry nested elsewhere so it isn't listed twice.
  const strip = (xs: MenuItem[]): MenuItem[] => xs.filter((x) => !isGroup(x)).map((x) => ({ ...x, children: strip(x.children ?? []) }));
  let out = strip(base);
  if (i >= 0) out.splice(Math.min(i, out.length), 0, item);
  else {
    const para = out.findIndex((x) => /parapharmacy/i.test(x.label));
    out.splice(para >= 0 ? para : out.length, 0, item);
  }
  if (hadBody) {
    // Keep body care one click away from Skin Care.
    const has = (xs: MenuItem[]): boolean => xs.some((x) => /category=body|body-care/i.test(x.href) || has(x.children ?? []));
    out = out.map((x) => (/^skin\s*care$/i.test(x.label) && !has(x.children ?? []) ? { ...x, children: [...(x.children ?? []), { label: "Body & Bath", href: "/shop/?category=body", children: [] }] } : x));
  }
  return out;
}
