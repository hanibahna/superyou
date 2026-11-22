import "server-only";

// Import a catalog from another Shopify store's public product feed (/products.json),
// e.g. a supplier or partner who has given permission. Each size/shade becomes one
// SuperYou product; sizes of the same item share a group and show as one card.
//
// The category/concern/badge rules below are tuned for parapharmacy & beauty stores
// (they were written against Neovitale's tags) and fall back to keyword matching.

import type { ProductInput } from "@/lib/product-input";
import { landed, type LandedPricing } from "@/lib/sourcing";

export type SourceProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  created_at: string;
  tags: string[] | string;
  options?: { name: string }[];
  variants: {
    id: number;
    title: string;
    sku: string | null;
    barcode?: string | null;
    price: string;
    compare_at_price: string | null;
    available: boolean;
    option1?: string | null;
    featured_image?: { src: string } | null;
  }[];
  images: { src: string }[];
};

export type ImportOptions = {
  adjustPct: number; // e.g. -5 = 5% cheaper than the source price
  round: "cents" | "quarter" | "none";
  asDraft: boolean;
  skuPrefix: string; // e.g. "NEO"
  sourceName: string; // e.g. "neovitale.com"
  landed?: LandedPricing; // international catalogs: shop price = landed cost (freight, duty, VAT) + margin
};

export function normaliseSourceUrl(input: string): URL {
  const raw = input.trim().replace(/\/+$/, "");
  const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!/^https?:$/.test(u.protocol)) throw new Error("Use a web address like neovitale.com");
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(u.hostname) && process.env.NODE_ENV === "production" && !process.env.ALLOW_LOCAL_IMPORT) throw new Error("That address isn't allowed");
  return new URL(u.origin);
}

export async function fetchSourcePage(origin: URL, page: number): Promise<SourceProduct[]> {
  const res = await fetch(`${origin.origin}/products.json?limit=250&page=${page}`, {
    headers: { "User-Agent": "SuperYou-Catalog-Import/1.0", Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`The store answered ${res.status}. Is it a Shopify store with a public catalog?`);
  const j = (await res.json()) as { products?: SourceProduct[] };
  if (!Array.isArray(j.products)) throw new Error("No product feed found at that address.");
  return j.products;
}

// ── Text helpers ────────────────────────────────────────────

const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&eacute;/g, "é").replace(/&egrave;/g, "è").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export function htmlToText(html: string | null): string {
  if (!html) return "";
  return decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<\/(p|div|h[1-6]|tr|ul|ol)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Pull "How to use" and "Ingredients" sections out of a description when they're labelled. */
export function splitSections(text: string): { description: string; howToUse: string; ingredients: string } {
  const lines = text.split("\n");
  const out = { description: [] as string[], howToUse: [] as string[], ingredients: [] as string[] };
  let cur: keyof typeof out = "description";
  for (const line of lines) {
    const l = line.trim();
    const head = l.replace(/^[•\-\s]+/, "").replace(/[:：]\s*$/, "").toLowerCase();
    if (/^(how to use|directions( for use)?|usage|application|mode d'emploi)\b/.test(head) && head.length < 40) {
      cur = "howToUse";
      const rest = l.replace(/^[^:：]*[:：]/, "").trim();
      if (rest && rest !== l) out[cur].push(rest);
      continue;
    }
    if (/^(ingredients?|composition|inci|key ingredients|active ingredients)\b/.test(head) && head.length < 40) {
      cur = "ingredients";
      const rest = l.replace(/^[^:：]*[:：]/, "").trim();
      if (rest && rest !== l) out[cur].push(rest);
      continue;
    }
    out[cur].push(l);
  }
  return { description: out.description.join("\n").trim(), howToUse: out.howToUse.join("\n").trim(), ingredients: out.ingredients.join("\n").trim() };
}

// ── Classification ──────────────────────────────────────────

const has = (tags: Set<string>, ...names: string[]) => names.some((n) => tags.has(n.toLowerCase()));
const re = (s: string, r: RegExp) => r.test(s);

export function categorize(p: SourceProduct, tags: Set<string>): string {
  const t = p.product_type.toLowerCase();
  const title = p.title.toLowerCase();
  const dental = has(tags, "dental care", "toothpaste", "toothbrush", "mouth wash", "dental floss", "electric toothbrush", "regular toothbrush") || re(title, /\b(toothpaste|toothbrush|mouthwash|dental floss)\b/);
  const sun = has(tags, "sunscreen", "sun care", "sun protection", "sunscreen stick", "after sun") || re(title, /\b(spf|sunscreen|sun ?block|after.?sun)\b/);
  const fragrance = has(tags, "perfume mist", "fragrance mist", "eau de parfum", "eau de toilette", "perfume", "body splash", "fragrance water", "fragrant water", "luxury fragrance", "casual fragrance", "eau de cologne") || re(title, /\b(eau de (parfum|toilette|cologne)|perfume|body mist|fragrance mist)\b/);
  const nails = has(tags, "nail polish", "nails", "nails care", "nail care", "casual nail care", "manicure & pedicure tools", "dermocosmetics nail care") || re(title, /\b(nail polish|nail lacquer|top coat|base coat)\b/);
  const body = has(tags, "bath & body", "body lotion & oils", "body wash & shower gel", "body moisturizers & lotions", "deodorant & body spray", "bath & shower", "intimate hygiene", "foot & hand care", "scrubs & exfoliators", "body wash") || re(title, /\b(body (lotion|cream|wash|oil|milk|scrub)|shower gel|deodorant|hand cream|foot cream|soap)\b/);
  const hairy = has(tags, "hair care", "shampoo", "conditionner", "conditioner", "hair treatment", "hair mask", "dermocosmetics hair care", "hair serum", "leave-in conditioner", "hair coloration", "hair color") || re(title, /\b(shampoo|conditioner|hair)\b/);
  const supplement = has(tags, "supplement", "food supplement", "protein powder", "vitamins") || re(title, /\b(capsules?|caps|tablets?|tabs|softgels?|gummies|sachets?|vitamin|mg|mcg|iu)\b/);

  if (t.includes("gift card") || t === "posm") return "";
  if (t.includes("fragrance") || (fragrance && !t.includes("baby"))) return "Fragrance";
  if (t.includes("men")) return "Men";
  if (t.includes("baby")) return "Baby & Mom";
  if (t.includes("hair")) return "Hair";
  const makeupWord = re(title, /\b(lip|liner|mascara|eye|brow|foundation|concealer|blush|bronzer|highlighter|powder|primer|palette|lipstick|gloss)/);
  if (t.includes("cosmetic") || t.includes("makeup") || t.includes("make up")) return nails && !makeupWord ? "Nails" : body && !makeupWord ? "Body & Bath" : "Makeup";
  if (t.includes("health")) return dental ? "Oral Care" : supplement ? "Supplements" : "Health & Medical";
  // Care, deals, luxury, unknown types → decide from tags/title
  if (dental) return "Oral Care";
  if (sun) return "Suncare";
  if (supplement && !hairy) return "Supplements";
  if (nails && !makeupWord) return "Nails";
  if (hairy && !re(title, /\b(face|eye)\b/)) return "Hair";
  if (body) return "Body & Bath";
  if (has(tags, "luxury make up", "foundation", "mascara", "lipstick", "concealer", "eyeliner", "casual make up")) return "Makeup";
  return "Skincare";
}

export function concernsFor(p: SourceProduct, tags: Set<string>, category: string): string[] {
  const out = new Set<string>();
  const title = p.title.toLowerCase();
  const add = (cond: boolean, name: string) => cond && out.add(name);
  add(has(tags, "acne", "acne-prone skin", "blemish - prone skin", "blemishes") || re(title, /\b(acne|blemish|imperfection)/), "Acne & Blemishes");
  add(has(tags, "dry skin", "dry to very dry skin", "very dry skin", "hydration", "dehydrated skin"), "Dryness");
  add(has(tags, "wrinkles", "anti-aging", "anti aging", "firming", "anti-wrinkle") || re(title, /\b(anti.?(aging|age|wrinkle)|retinol|lift)/), "Anti-Aging");
  add(has(tags, "hyperpigmentation", "dark spots", "pigmentation", "brightening") || re(title, /\b(dark spot|pigment|brighten|melasma)/), "Dark Spots");
  add(has(tags, "sensitive skin", "sensitive"), "Sensitive Skin");
  add(has(tags, "oily skin", "normal to oily skin", "combination skin"), "Oily Skin");
  add(has(tags, "redness", "rosacea"), "Redness");
  add(has(tags, "eczema", "atopic skin", "atopic"), "Eczema & Atopic Skin");
  if (category === "Hair" || category === "Men") {
    add(has(tags, "hair loss") || re(title, /\b(hair loss|anti.?hair.?loss|thinning)/), "Hair Loss");
    add(has(tags, "dandruff") || re(title, /dandruff/), "Dandruff");
    add(has(tags, "colored hair"), "Colored Hair");
    add(has(tags, "damaged hair", "dry hair"), "Damaged & Dry Hair");
    add(has(tags, "curly hair"), "Curly Hair");
  }
  if (category === "Supplements") {
    add(re(title, /\b(vitamin c|zinc|immun|echinacea|elderberry|d3|vitamin d)\b/), "Immunity");
    add(re(title, /\b(melatonin|magnesium|sleep|ashwagandha|stress|relax)/), "Sleep & Stress");
    add(re(title, /\b(b12|b-?complex|iron|energy|coq10|ginseng|multivitamin)/), "Energy");
    add(re(title, /\b(calcium|glucosamine|joint|chondroitin|msm|k2|bone)/), "Bones & Joints");
    add(re(title, /\b(probiotic|digest|fib(er|re)|enzyme|gut)/), "Digestion");
    add(re(title, /\b(omega|fish oil|heart|cholesterol|krill)/), "Heart Health");
    add(re(title, /\bcollagen\b/), "Anti-Aging");
  }
  return [...out];
}

function badges(p: SourceProduct, tags: Set<string>, discount: number): string[] {
  const out = new Set<string>();
  if (has(tags, "best sellers", "best seller", "bestseller")) out.add("favorite");
  const ageDays = (Date.now() - Date.parse(p.created_at)) / 86400000;
  if (has(tags, "new arrivals", "new arrival", "new") || ageDays < 45) out.add("new");
  if (has(tags, "happy hour")) out.add("deal");
  if (has(tags, "up to 50%") || discount >= 0.35) out.add("mega");
  if (discount >= 0.45) out.add("half");
  if (has(tags, "gift sets", "bundle", "kit", "buy 1 get 1", "buy 1 get gift", "buy 2 get 1") || re(p.title.toLowerCase(), /\b(with (free )?gift|gift set|kit|duo|trio|bundle|coffret|set)\b/)) out.add("bundle");
  return [...out];
}

const roundPrice = (n: number, mode: ImportOptions["round"]) =>
  mode === "quarter" ? Math.max(0.25, Math.round(n * 4) / 4) : mode === "none" ? n : Math.round(n * 100) / 100;

const SIZE_OPTIONS = /^(size|sze|sizd|volume|capacity|quantity|weight)\s*$/i;

/** One source product → one import row per variant. */
export function mapSourceProduct(p: SourceProduct, opts: ImportOptions): (ProductInput & { group: string })[] {
  const tagList = (Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(",")).map((t) => t.trim()).filter(Boolean);
  const tags = new Set(tagList.map((t) => t.toLowerCase()));
  const category = categorize(p, tags);
  if (!category) return [];
  const concerns = concernsFor(p, tags, category);
  const text = splitSections(htmlToText(p.body_html));
  const images = p.images.map((i) => i.src);
  const optName = p.options?.[0]?.name ?? "";
  const group = `${opts.skuPrefix.toLowerCase()}-${p.id}`;

  return p.variants
    .filter((v) => Number(v.price) > 0)
    .map((v) => {
      const srcPrice = Number(v.price);
      const srcCompare = v.compare_at_price ? Number(v.compare_at_price) : 0;
      const price = opts.landed ? roundPrice(landed(srcPrice, opts.landed).price, opts.round) : roundPrice(srcPrice * (1 + opts.adjustPct / 100), opts.round);
      // Abroad the supplier's "was" price is a US price, not a SuperYou one: no strike-through for imports.
      const compareAt = !opts.landed && srcCompare > price ? srcCompare : undefined;
      const discount = compareAt ? 1 - price / compareAt : 0;
      const label = v.title && v.title !== "Default Title" ? v.title.trim().replace(/\s+/g, " ").slice(0, 80) : "";
      const barcode = (v.barcode || (v.sku && /^\d{8,14}$/.test(v.sku) ? v.sku : "")) ?? "";
      const vImg = v.featured_image?.src;
      return {
        sku: `${opts.skuPrefix}-${v.id}`,
        name: p.title.trim().slice(0, 200),
        brand: p.vendor.trim(),
        category,
        concerns,
        price,
        compareAt,
        size: label && SIZE_OPTIONS.test(optName) ? label.slice(0, 60) : "",
        variant: label || undefined,
        stock: undefined,
        status: opts.asDraft ? "draft" : "active",
        tags: badges(p, tags, discount),
        images: vImg ? [vImg, ...images.filter((s) => s !== vImg)] : images,
        description: text.description,
        howToUse: text.howToUse,
        ingredients: text.ingredients,
        barcode,
        slug: p.handle,
        group,
        source: opts.sourceName,
        cost: srcPrice,
        inStock: v.available, // the source publishes availability, not quantities
      } as ProductInput & { group: string };
    });
}
