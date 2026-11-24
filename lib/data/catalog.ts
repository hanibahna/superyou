// ─────────────────────────────────────────────────────────────
// Catalog types, defaults and SAMPLE products (placeholders only).
// Live data is stored in the database — see lib/catalog.ts and /admin.
// This file is safe to import from client components.
// ─────────────────────────────────────────────────────────────

export type Shape = "bottle" | "tube" | "jar" | "dropper" | "spray" | "box" | "tub";

export type Category = {
  slug: string;
  name: string;
  image?: string; // tile picture (homepage category tiles, category page banner)
  description?: string; // intro text on the category page
  menu?: boolean; // false = hidden from the main menu (still reachable by link)
  concernGroup?: "skin" | "hair" | "wellness" | ""; // concern list shown in the menu drop-down
};

export type Concern = { slug: string; name: string; group: "skin" | "hair" | "wellness"; image?: string };

export type Taxonomy = { categories: Category[]; concerns: Concern[] };

export const TAGS = ["deal", "mega", "favorite", "new", "bundle", "half"] as const;
export type Tag = (typeof TAGS)[number];

export const tagLabels: Record<Tag, string> = {
  deal: "Today's deals",
  mega: "Mega deals",
  favorite: "Customer favorites",
  new: "New arrivals",
  bundle: "Bundles & gifts",
  half: "Half price deals",
};

export type Product = {
  id: string;
  sku: string; // your unique code — imports match on this
  slug: string;
  name: string;
  brand: string;
  category: string; // category slug
  concerns: string[]; // concern slugs
  price: number; // selling price
  compareAt?: number; // original price, if on sale
  size: string;
  images: string[]; // image URLs; empty → drawn placeholder
  stock?: number; // optional quantity; when set, 0 = sold out
  inStock: boolean;
  status: "active" | "draft";
  tags: Tag[];
  description: string;
  howToUse: string;
  ingredients: string;
  barcode?: string;
  shape: Shape; // placeholder packshot only
  color: string; // placeholder packshot only
  group?: string; // products sharing a group are sizes/shades of one item (shown as one card)
  variant?: string; // this item's size/shade label within its group, e.g. "50 ml"
  source?: string; // where it was imported from, e.g. "neovitale.com"
  cost?: number; // supplier price in USD (international catalogs: before freight, duty and VAT)
  collections?: string[]; // collection keys (e.g. "luxury-make-up", "vichy/Medical-Make-Up") used by menus
  photosFrom?: string; // photos replaced from another store (kept on re-import), e.g. "feel22.com"
  video?: string; // "how to use" video: YouTube, TikTok, Instagram, Vimeo link or uploaded file
  updatedAt?: string;
};

/** Lightweight record kept in the fast in-memory index (no long texts, first image only). */
export type ProductLite = Omit<Product, "description" | "howToUse" | "ingredients" | "images" | "video"> & {
  image?: string; imageCount: number; rating?: number; reviewCount?: number;
  /** Filled in live from Admin → Sourcing: local stock or international drop shipping, and delivery time. */
  origin?: "local" | "international"; shipFrom?: string; daysMin?: number; daysMax?: number;
  /** Price guarantee: matched a lower competitor price. The shop's name, or "" when it is not shown. */
  match?: string;
  /** SuperPrice: our price before it, and the competitor's price. */
  matchWas?: number;
  matchVs?: number;
  /** Already the best price: the cheapest other shop's price, and its name ("" = not shown). */
  cmpVs?: number;
  cmpShop?: string;
};

export const toLite = (p: Product): ProductLite => {
  const { description: _d, howToUse: _h, ingredients: _i, images, video: _v, ...rest } = p;
  return { ...rest, image: images[0], imageCount: images.length };
};

/** Cards and lists accept either shape. */
export type AnyProduct = Product | ProductLite;
export const firstImage = (p: { images?: string[]; image?: string }) => p.image ?? p.images?.[0];

export const defaultCategories: Category[] = [
  { slug: "skincare", name: "Skincare" },
  { slug: "suncare", name: "Suncare" },
  { slug: "makeup", name: "Makeup" },
  { slug: "hair", name: "Hair" },
  { slug: "body", name: "Body & Bath" },
  { slug: "fragrance", name: "Fragrance" },
  { slug: "nails", name: "Nails" },
  { slug: "men", name: "Men" },
  { slug: "baby", name: "Baby & Mom" },
  { slug: "supplements", name: "Supplements" },
  { slug: "health", name: "Health & Medical" },
  { slug: "oral-care", name: "Oral Care" },
];

export const defaultConcerns: Concern[] = [
  { slug: "acne", name: "Acne & Blemishes", group: "skin" },
  { slug: "dryness", name: "Dryness", group: "skin" },
  { slug: "anti-aging", name: "Anti-Aging", group: "skin" },
  { slug: "pigmentation", name: "Dark Spots", group: "skin" },
  { slug: "sensitive", name: "Sensitive Skin", group: "skin" },
  { slug: "oily-skin", name: "Oily Skin", group: "skin" },
  { slug: "redness", name: "Redness", group: "skin" },
  { slug: "eczema", name: "Eczema & Atopic Skin", group: "skin" },
  { slug: "hair-loss", name: "Hair Loss", group: "hair" },
  { slug: "dandruff", name: "Dandruff", group: "hair" },
  { slug: "colored-hair", name: "Colored Hair", group: "hair" },
  { slug: "damaged-hair", name: "Damaged & Dry Hair", group: "hair" },
  { slug: "curly-hair", name: "Curly Hair", group: "hair" },
  { slug: "immunity", name: "Immunity", group: "wellness" },
  { slug: "sleep", name: "Sleep & Stress", group: "wellness" },
  { slug: "energy", name: "Energy", group: "wellness" },
  { slug: "bones-joints", name: "Bones & Joints", group: "wellness" },
  { slug: "digestion", name: "Digestion", group: "wellness" },
  { slug: "heart", name: "Heart Health", group: "wellness" },
];

const lorem = {
  description:
    "Placeholder description. Replace with the product's real copy: what it does, who it's for, key benefits and texture.",
  howToUse: "Placeholder usage instructions. Apply as directed on the packaging.",
  ingredients: "Placeholder INCI list. Aqua, Glycerin, …",
};

type Seed = Omit<Product, "id" | "sku" | "slug" | "description" | "howToUse" | "ingredients" | "images" | "status">;

const seeds: Seed[] = [
  { name: "Hydra Barrier Serum", brand: "Dermalis", category: "skincare", concerns: ["dryness", "sensitive"], price: 14.4, compareAt: 24, size: "30 ml", shape: "dropper", color: "#7cc6d6", inStock: true, tags: ["deal", "favorite"] },
  { name: "Clarifying Foaming Gel", brand: "Dermalis", category: "skincare", concerns: ["acne"], price: 11.62, compareAt: 15.5, size: "200 ml", shape: "bottle", color: "#9ad1a5", inStock: true, tags: ["mega", "favorite"] },
  { name: "Micellar Cleansing Water", brand: "Dermalis", category: "skincare", concerns: ["sensitive"], price: 15, compareAt: 20, size: "500 ml", shape: "bottle", color: "#f2b8c6", inStock: true, tags: ["mega", "favorite"] },
  { name: "Invisible Fluid SPF50+", brand: "Solenne", category: "suncare", concerns: ["sensitive"], price: 16.83, compareAt: 22.44, size: "50 ml", shape: "tube", color: "#f6c46b", inStock: true, tags: ["deal", "mega"] },
  { name: "Tinted Mineral Cream SPF50+", brand: "Solenne", category: "suncare", concerns: ["pigmentation"], price: 20.62, compareAt: 27.5, size: "50 ml", shape: "tube", color: "#e6b48f", inStock: true, tags: ["deal"] },
  { name: "Kids Sun Milk SPF50+", brand: "Solenne", category: "suncare", concerns: ["sensitive"], price: 18, compareAt: 30, size: "200 ml", shape: "spray", color: "#ffd166", inStock: true, tags: ["deal"] },
  { name: "Retinal Night Cream", brand: "Kurah", category: "skincare", concerns: ["anti-aging"], price: 52.5, compareAt: 70, size: "50 ml", shape: "jar", color: "#b9a3d6", inStock: true, tags: ["new"] },
  { name: "Vitamin C 20% Serum", brand: "Kurah", category: "skincare", concerns: ["pigmentation", "anti-aging"], price: 9.8, compareAt: 14, size: "30 ml", shape: "dropper", color: "#f4a259", inStock: true, tags: ["half", "favorite"] },
  { name: "Niacinamide 10% Moisturizer", brand: "Kurah", category: "skincare", concerns: ["acne"], price: 8.82, compareAt: 12.6, size: "50 ml", shape: "tube", color: "#cfe3f2", inStock: false, tags: ["half"] },
  { name: "Cica Repair Balm", brand: "Botanie", category: "skincare", concerns: ["sensitive", "dryness"], price: 13, compareAt: 17.33, size: "40 ml", shape: "tube", color: "#a3c9a8", inStock: true, tags: ["mega"] },
  { name: "Glow Water Essence", brand: "Botanie", category: "skincare", concerns: ["dryness"], price: 17.57, compareAt: 29.28, size: "100 ml", shape: "bottle", color: "#d6e8f0", inStock: true, tags: ["deal", "new"] },
  { name: "Anti-Dark Spot Eye Cream", brand: "Botanie", category: "skincare", concerns: ["pigmentation"], price: 15, compareAt: 25, size: "15 ml", shape: "tube", color: "#e9c9b1", inStock: true, tags: ["deal"] },
  { name: "Energising Shampoo", brand: "Capilla", category: "hair", concerns: ["hair-loss"], price: 13.77, compareAt: 18.36, size: "200 ml", shape: "bottle", color: "#6fb07f", inStock: true, tags: ["mega"] },
  { name: "Anti-Dandruff Shampoo", brand: "Capilla", category: "hair", concerns: ["dandruff"], price: 12, compareAt: 16, size: "200 ml", shape: "bottle", color: "#8fb8de", inStock: true, tags: ["bundle"] },
  { name: "Color Protect Mask", brand: "Capilla", category: "hair", concerns: ["colored-hair"], price: 21.09, size: "200 ml", shape: "tub", color: "#c47d9b", inStock: true, tags: ["new"] },
  { name: "Hair Density Serum", brand: "Capilla", category: "hair", concerns: ["hair-loss"], price: 10.5, compareAt: 15, size: "50 ml", shape: "dropper", color: "#7a9e7e", inStock: true, tags: ["half"] },
  { name: "Lipid Replenishing Body Cream", brand: "Dermalis", category: "body", concerns: ["dryness"], price: 5.65, compareAt: 7.53, size: "340 g", shape: "tub", color: "#e0eef5", inStock: true, tags: ["mega", "favorite"] },
  { name: "48H Roll-On Deodorant", brand: "Hydrea", category: "body", concerns: ["sensitive"], price: 12.75, compareAt: 17, size: "50 ml", shape: "bottle", color: "#b5d3e7", inStock: true, tags: ["favorite"] },
  { name: "Honey Shower Gel", brand: "Hydrea", category: "body", concerns: [], price: 6, size: "250 ml", shape: "bottle", color: "#f3c969", inStock: true, tags: ["new"] },
  { name: "Baby 2-in-1 Cleansing Gel", brand: "Petale", category: "baby", concerns: ["sensitive"], price: 7.77, size: "500 ml", shape: "bottle", color: "#ffe3a3", inStock: true, tags: ["favorite"] },
  { name: "Vitamin Barrier Cream", brand: "Petale", category: "baby", concerns: ["dryness"], price: 5.83, size: "100 ml", shape: "tube", color: "#ffd0b5", inStock: true, tags: ["mega"] },
  { name: "Hydrating Lip Gloss", brand: "Lumi", category: "makeup", concerns: [], price: 10, size: "5.4 ml", shape: "tube", color: "#e98a9c", inStock: true, tags: ["favorite"] },
  { name: "Eraser Concealer", brand: "Lumi", category: "makeup", concerns: [], price: 11.5, size: "6 ml", shape: "tube", color: "#d9a68a", inStock: true, tags: ["new"] },
  { name: "Vitamin D3 + K2 Drops", brand: "NutriPure", category: "supplements", concerns: ["immunity"], price: 18, compareAt: 24, size: "20 ml", shape: "dropper", color: "#f7b267", inStock: true, tags: ["deal", "favorite"] },
  { name: "Magnesium Bisglycinate", brand: "NutriPure", category: "supplements", concerns: ["sleep", "energy"], price: 22, size: "60 caps", shape: "tub", color: "#9fb4e0", inStock: true, tags: ["new"] },
  { name: "Collagen Peptides", brand: "NutriPure", category: "supplements", concerns: ["anti-aging"], price: 34, compareAt: 45, size: "300 g", shape: "tub", color: "#f4c7c3", inStock: true, tags: ["bundle"] },
  { name: "Immune Defence Effervescent", brand: "NutriPure", category: "supplements", concerns: ["immunity"], price: 9.5, size: "20 tabs", shape: "tube", color: "#ffb347", inStock: true, tags: ["mega"] },
  { name: "Hair, Skin & Nails Complex", brand: "NutriPure", category: "supplements", concerns: ["hair-loss"], price: 26, compareAt: 32, size: "60 tabs", shape: "tub", color: "#d5a6bd", inStock: true, tags: ["bundle", "new"] },
  { name: "Plumping Serum + Free Gift", brand: "Kurah", category: "skincare", concerns: ["anti-aging", "dryness"], price: 39, compareAt: 52, size: "30 ml", shape: "box", color: "#a8c5e6", inStock: true, tags: ["bundle"] },
  { name: "Smart Body Composition Scale", brand: "Vitacore", category: "health", concerns: [], price: 30, size: "1 unit", shape: "box", color: "#9aa5b1", inStock: true, tags: ["new"] },
  { name: "Digital Thermometer", brand: "Vitacore", category: "health", concerns: [], price: 12, size: "1 unit", shape: "box", color: "#c0d6df", inStock: true, tags: [] },
  { name: "Time-Filler Eye Cream", brand: "Kurah", category: "skincare", concerns: ["anti-aging"], price: 58.8, compareAt: 84, size: "15 ml", shape: "jar", color: "#c9b6e4", inStock: true, tags: ["half"] },
];

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\+/g, "plus")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const sampleProducts: Product[] = seeds.map((s, i) => ({
  ...s,
  id: `p${String(i + 1).padStart(3, "0")}`,
  sku: `SAMPLE-${String(i + 1).padStart(3, "0")}`,
  slug: slugify(`${s.brand} ${s.name}`),
  images: [],
  status: "active",
  ...lorem,
}));

export function discountPct(p: { price: number; compareAt?: number }): number | null {
  if (!p.compareAt || p.compareAt <= p.price) return null;
  return Math.round((1 - p.price / p.compareAt) * 100);
}

export const brandsOf = (list: { brand: string }[]) => Array.from(new Set(list.map((p) => p.brand))).sort();

/** Tidy a product name for display: one line, single spaces, and SHOUTING names in normal case. */
export function cleanName(name: string): string {
  let s = (name ?? "").replace(/\s+/g, " ").trim();
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 8 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.75) {
    s = s.toLowerCase().replace(/(^|[\s(\-/&+])([a-z])/g, (_, a, b) => a + b.toUpperCase())
      .replace(/\b(Spf|Uv|Uva|Uvb|Bb|Cc|Pa|Ml|Mg|Mcg|Iu|Ph|Aha|Bha|Pha|Q10|Dna|Uk|Usa|Xl|Xxl)\b/g, (w) => /^(Ml|Mg|Mcg)$/.test(w) ? w.toLowerCase() : w.toUpperCase())
      .replace(/\bSpf(?=\d)/g, "SPF");
  }
  return s;
}

/** Brand + name for titles, without repeating the brand when the name already starts with it. */
export function fullName(brand: string | undefined, name: string): string {
  const n = cleanName(name);
  const b = (brand ?? "").trim();
  if (!b) return n;
  // Name already starts with the brand: keep the brand's own spelling, then the rest.
  return n.toLowerCase().startsWith(b.toLowerCase()) ? b + n.slice(b.length) : `${b} ${n}`;
}

/** Name shown under a separate brand line: drops a leading brand ("RIMMEL LONDON Kate Kit" → "Kate Kit"). */
export function shortName(brand: string | undefined, name: string): string {
  const n = cleanName(name);
  const b = (brand ?? "").trim();
  if (b && n.length > b.length + 2 && n.toLowerCase().startsWith(b.toLowerCase() + " ")) return n.slice(b.length + 1);
  return n;
}
