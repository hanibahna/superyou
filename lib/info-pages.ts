import "server-only";

// Pages under /pages/… Many were copied as text from another shop's brand and range pages, so their
// text holds product lists ("Add To Cart", prices) and leftover checkout code, but no pictures.
// Here the text is cleaned, and brand/range pages show real products from the live catalog instead.

import { getTaxonomy } from "@/lib/catalog";
import { slugify, type ProductLite } from "@/lib/data/catalog";
import { toCards, type CardItem } from "@/lib/listing";
import { liveProducts } from "@/lib/pricing";
import { searchProducts } from "@/lib/search";
import { getSearchSettings } from "@/lib/site-store";

const compact = (s: string) => slugify(s).replace(/-/g, "");

/** Remove website code and the copied product lists, keep the writing. */
export function cleanPageText(body: string): string {
  let t = body
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;|&#39;|&amp;|&nbsp;/g, (m) => ({ "&quot;": '"', "&#39;": "'", "&amp;": "&", "&nbsp;": " " })[m] ?? " ");
  const lines = t.split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const isPrice = (l: string) => /^(\$|usd\s?)?\d[\d.,]*\s*(\$\d[\d.,]*)?$/i.test(l) || /^\$\d[\d.,]*\$\d[\d.,]*$/.test(l);
  const noise = /^(sale off|add to cart|view all|shop now|discover now|discover more|shop the range|learn more|read more|sold out|quick view|choose options|select options)$/i;
  const drop = new Set<number>();
  lines.forEach((l, i) => {
    if (!l || noise.test(l) || /^shop\s+[^.]{1,30}$/i.test(l)) drop.add(i);
    if (isPrice(l)) {
      // the price, the product name above it, and a short brand or size line above that
      drop.add(i);
      if (i > 0 && lines[i - 1].length <= 120) drop.add(i - 1);
      if (i > 1 && lines[i - 2].length <= 40 && !/[.!?]$/.test(lines[i - 2])) drop.add(i - 2);
    }
  });
  t = lines.filter((l, i) => !drop.has(i) && !/(shopify|data-|wallet-|access-token|class=|=")/i.test(l)).join("\n");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

/** Paragraphs worth reading (for brand and range pages): no headings or menu words. */
export function intro(text: string, max = 3) {
  return [...new Set(text.split("\n").filter((l) => l.length >= 70))].slice(0, max);
}

const GENERIC = new Set(["1", "2", "3", "hair", "expert", "moment", "campaign", "collection", "collections", "landing", "page", "new", "products", "bundles", "offers", "quiz", "the"]);

export type PageProducts = { brand?: string; query?: string; cards: CardItem[]; total: number; viewAll: string };

/** Products for a brand or range page: the brand in its address, narrowed by the range words when they match. */
export async function pageProducts(slug: string, title: string): Promise<PageProducts | null> {
  const live = await liveProducts();
  const c = compact(slug);
  // The brand named in the address (longest match, e.g. "la-roche-posay-oily-acne" → La Roche-Posay).
  const brands = new Map<string, string>();
  for (const p of live.list) brands.set(compact(p.brand), p.brand);
  let brand: string | undefined;
  for (const [k, name] of brands) if (k.length >= 4 && c.includes(k) && (!brand || k.length > compact(brand).length)) brand = name;
  const [tax, ss] = await Promise.all([getTaxonomy(), getSearchSettings()]);
  let pool: ProductLite[] = brand ? live.list.filter((p) => p.brand === brand) : live.list;
  const rest = slug.split("-").filter((w) => !GENERIC.has(w) && !(brand && compact(brand).includes(w.replace(/[^a-z0-9]/g, ""))) && w.length > 1).join(" ");
  const cleanTitle = title.replace(/\|.*$/, "").replace(/^(shop by range|our categories)$/i, "").trim();
  let query: string | undefined;
  for (const q of [rest, brand ? "" : cleanTitle].filter(Boolean)) {
    const hits = searchProducts(pool, q, tax, ss);
    if (hits.length >= (brand ? 4 : 2)) {
      pool = hits;
      query = q;
      break;
    }
  }
  if (!brand && !query) return null;
  const cards = toCards(pool).sort((a, b) => Number(b.inStock) - Number(a.inStock) || Number(!!b.image) - Number(!!a.image));
  if (!cards.length) return null;
  const viewAll = brand && !query ? `/shop/?brand=${encodeURIComponent(brand)}` : `/shop/?q=${encodeURIComponent([brand, query].filter(Boolean).join(" "))}`;
  return { brand, query, cards: cards.slice(0, 24), total: cards.length, viewAll };
}

/** Pages copied from the other shop that only make sense there (its stores, its staff picks, blank drafts). */
export const foreignPage = (slug: string) => /^(our-locations|head-of-therapy-department|landing-page-blank|.*-select$|influencers-picks|loreal-paris-rate-review|find-your-match|pharmacist|the-sun-is-blue|cpd-singles-day)$|^(landing-page-blank|influencers-picks)/.test(slug);
