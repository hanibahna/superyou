import "server-only";

// Match products from a photo-source store (e.g. Feel22) to SuperYou items by
// brand + name + size, with guards so a shampoo never matches a conditioner,
// retinol never matches retinal, and shade 312 never matches shade 313.

import { fullName, type ProductLite } from "@/lib/data/catalog";
import type { SourceProduct } from "@/lib/import/shopify-source";

const deaccent = (s: string) => (s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

const BRAND_DROP = new Set(["paris", "new", "york", "eau", "thermale", "laboratoires", "laboratoire", "labs", "lab", "cosmetics", "professional", "professionnel", "the", "de", "and", "skin", "care", "usa", "london", "milano", "beauty", "dr"]);
export function brandKey(b: string): string {
  const w = deaccent(b).split(/[^a-z0-9]+/).filter((x) => x && !BRAND_DROP.has(x));
  return w.join("") || deaccent(b).replace(/[^a-z0-9]/g, "");
}

const STOP = new Set(["for", "with", "and", "the", "de", "a", "of", "to", "in", "by", "new", "spf", "plus", "ml", "g", "gr", "set", "x", "pack", "skin"]);
const UNIT = "(ml|g|gr|oz|caps|capsules|tabs|tablets|softgels|pcs|l)";
const SIZE_RE = new RegExp(`\\d+(?:[.,]\\d+)?\\s?${UNIT}\\b`, "g");

export const sizesOf = (s: string) => new Set((deaccent(s).match(SIZE_RE) ?? []).map((m) => m.replace(/\s/g, "").replace("gr", "g")));

export function tokensOf(s: string, brand = ""): Set<string> {
  const bt = new Set(deaccent(brand).split(/[^a-z0-9]+/));
  const t = deaccent(s).replace(SIZE_RE, " ");
  return new Set(t.split(/[^a-z0-9+]+/).filter((x) => x && x.length > 1 && !STOP.has(x) && !bt.has(x)));
}

const TYPES = new Set("cream creme shampoo conditioner conditionner mask serum cream gel lotion oil spray balm cleanser toner deodorant mist fluid foam mousse scrub stick lipstick gloss mascara eyeliner liner powder foundation concealer blush primer palette soap water emulsion patches capsules tablets toothpaste toothbrush perfume parfum toilette polish remover wash milk essence ampoule peel exfoliant sunscreen".split(" "));
const MUST_AGREE = new Set("retinol retinal glycolic salicylic niacinamide hyaluronic ferulic azelaic lactic tranexamic men homme kids baby tinted night day eye eyes hand body lip lips face hair nail".split(" "));

function compatible(a: Set<string>, b: Set<string>): boolean {
  const ta = [...a].filter((x) => TYPES.has(x));
  const tb = [...b].filter((x) => TYPES.has(x));
  if (ta.length && tb.length && !ta.some((x) => tb.includes(x))) return false;
  for (const x of MUST_AGREE) if (a.has(x) !== b.has(x)) return false;
  const na = [...a].filter((x) => /^\d+$/.test(x));
  const nb = [...b].filter((x) => /^\d+$/.test(x));
  if (na.length && nb.length && !na.some((x) => nb.includes(x))) return false;
  return true;
}

export function score(ours: { tokens: Set<string>; sizes: Set<string> }, theirs: { tokens: Set<string>; sizes: Set<string> }): number {
  if (!ours.tokens.size || !theirs.tokens.size || !compatible(ours.tokens, theirs.tokens)) return 0;
  let inter = 0;
  for (const t of ours.tokens) if (theirs.tokens.has(t)) inter++;
  if (!inter) return 0;
  const union = ours.tokens.size + theirs.tokens.size - inter;
  const cover = inter / ours.tokens.size;
  let s = 0.55 * (inter / union) + 0.45 * cover;
  if (ours.sizes.size && theirs.sizes.size && [...ours.sizes].some((x) => theirs.sizes.has(x))) s += 0.1;
  // A strong match must contain (nearly) every word of our product name.
  if (cover < (ours.tokens.size <= 4 ? 1 : 0.85)) s = Math.min(s, 0.7);
  return s;
}

export type Group = { slug: string; brand: string; name: string; ids: string[]; tokens: Set<string>; sizes: Set<string>; shades: boolean; photosFrom?: string; image?: string };

/** Our items grouped by brand key (one entry per card). */
export function groupsByBrand(all: ProductLite[]): Map<string, Group[]> {
  const bySlug = new Map<string, ProductLite[]>();
  for (const p of all) (bySlug.get(p.slug) ?? bySlug.set(p.slug, []).get(p.slug)!).push(p);
  const out = new Map<string, Group[]>();
  for (const [slug, vs] of bySlug) {
    const first = vs[0];
    const distinctImages = new Set(vs.map((v) => v.image).filter(Boolean));
    const g: Group = {
      slug,
      brand: first.brand,
      name: first.name,
      ids: vs.map((v) => v.id),
      tokens: tokensOf(first.name, first.brand),
      sizes: sizesOf([first.name, ...vs.map((v) => v.variant ?? v.size)].join(" ")),
      // Each shade has its own photo → swapping in one generic photo would be wrong.
      shades: vs.length > 1 && distinctImages.size > 1,
      photosFrom: first.photosFrom,
      image: vs.find((v) => v.image)?.image,
    };
    const k = brandKey(first.brand);
    (out.get(k) ?? out.set(k, []).get(k)!).push(g);
  }
  return out;
}

export type Suggestion = { slug: string; ours: string; oursImage?: string; theirs: string; theirsUrl: string; score: number; images: string[]; already?: string };

/** Best match among this page of source products, per our item. */
export function matchPage(groups: Map<string, Group[]>, page: SourceProduct[], origin: string, minScore: number): Suggestion[] {
  const best = new Map<string, Suggestion>();
  for (const sp of page) {
    if (!sp.images?.length) continue;
    const k = brandKey(sp.vendor);
    let cands = groups.get(k);
    if (!cands && k.length >= 4) for (const [kk, list] of groups) if (kk.includes(k) || k.includes(kk)) cands = [...(cands ?? []), ...list];
    if (!cands) continue;
    const theirs = { tokens: tokensOf(sp.title, sp.vendor), sizes: sizesOf([sp.title, ...sp.variants.map((v) => v.title)].join(" ")) };
    for (const g of cands) {
      if (g.shades) continue;
      const s = score(g, theirs);
      if (s < minScore) continue;
      const prev = best.get(g.slug);
      if (!prev || s > prev.score)
        best.set(g.slug, { slug: g.slug, ours: `${fullName(g.brand, g.name)}`, oursImage: g.image, already: g.photosFrom, theirs: sp.title, theirsUrl: `${origin}/products/${sp.handle}`, score: Math.round(s * 100) / 100, images: sp.images.slice(0, 8).map((i) => i.src) });
    }
  }
  return [...best.values()];
}
