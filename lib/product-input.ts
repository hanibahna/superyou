// Shared rules for turning form fields or spreadsheet rows into products.
// Used by the admin form, the CSV/Excel importer and the API.

import { z } from "zod";
import { slugify, TAGS, type Product, type Shape, type Tag, type Taxonomy } from "@/lib/data/catalog";

const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[$,\s]|USD|LBP/gi, ""));
  return Number.isFinite(n) ? n : NaN;
};

/** Missing column or empty cell → keep the current value (arrays from the editor are always explicit). */
const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

const list = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(String).map((s) => s.trim()).filter(Boolean)
    : String(v ?? "")
        .split(/[|;,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

/** Loose input — every field optional except the ones checked below. */
export const productInputSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(1, "SKU is required").max(64),
  name: z.string().trim().min(1, "Name is required").max(200),
  brand: z.string().trim().max(80).optional().default(""),
  category: z.string().trim().max(80).optional().default(""),
  concerns: z.unknown().optional(),
  price: z.unknown(),
  compareAt: z.unknown().optional(),
  size: z.string().trim().max(60).optional().default(""),
  stock: z.unknown().optional(),
  status: z.string().optional(),
  tags: z.unknown().optional(),
  images: z.unknown().optional(),
  description: z.string().max(10000).optional().default(""),
  howToUse: z.string().max(5000).optional().default(""),
  ingredients: z.string().max(10000).optional().default(""),
  video: z.string().max(500).optional(),
  collections: z.array(z.string().max(200)).max(200).optional(),
  barcode: z.string().trim().max(64).optional().default(""),
  slug: z.string().optional(),
  group: z.string().trim().max(120).optional(),
  variant: z.string().trim().max(80).optional(),
  source: z.string().trim().max(80).optional(),
  inStock: z.boolean().optional(),
});

export type ProductInput = z.input<typeof productInputSchema>;

const palette = ["#7cc6d6", "#9ad1a5", "#f2b8c6", "#f6c46b", "#b9a3d6", "#f4a259", "#a3c9a8", "#8fb8de", "#e9c9b1"];
const shapes: Shape[] = ["bottle", "tube", "jar", "dropper", "tub"];

/**
 * Validate and normalise one input. Unknown category/concern names are returned
 * in `newCategories` / `newConcerns` so the caller can add them to the taxonomy.
 */
export function normaliseProduct(
  raw: ProductInput,
  tax: Taxonomy,
  existing?: Product,
): { ok: true; product: Product; newCategories: string[]; newConcerns: string[] } | { ok: false; errors: string[] } {
  const parsed = productInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  const d = parsed.data;
  const errors: string[] = [];

  const price = num(d.price);
  if (price === undefined || Number.isNaN(price) || price < 0) errors.push("price: must be a number");
  const compareAt = num(d.compareAt);
  if (Number.isNaN(compareAt)) errors.push("compare-at price: must be a number");
  const stock = num(d.stock);
  if (Number.isNaN(stock)) errors.push("stock: must be a whole number");
  if (errors.length) return { ok: false, errors };

  // Category: match by slug or name, else create.
  const newCategories: string[] = [];
  let category = existing?.category ?? "";
  if (d.category) {
    const want = slugify(d.category);
    const hit = tax.categories.find((c) => c.slug === want || slugify(c.name) === want);
    category = hit?.slug ?? want;
    if (!hit) newCategories.push(d.category);
  }

  const newConcerns: string[] = [];
  const concerns =
    blank(d.concerns)
      ? existing?.concerns ?? []
      : list(d.concerns).map((c) => {
          const want = slugify(c);
          const hit = tax.concerns.find((k) => k.slug === want || slugify(k.name) === want);
          if (!hit) newConcerns.push(c);
          return hit?.slug ?? want;
        });

  const tags =
    blank(d.tags)
      ? existing?.tags ?? []
      : (list(d.tags).map((t) => t.toLowerCase()).filter((t) => (TAGS as readonly string[]).includes(t)) as Tag[]);

  const status = d.status
    ? /^(draft|hidden|inactive|no|0|false)$/i.test(d.status.trim()) ? "draft" : "active"
    : existing?.status ?? "active";

  const images = blank(d.images) ? existing?.images ?? [] : list(d.images).filter((u) => /^https?:\/\//i.test(u));
  const seed = [...d.sku].reduce((a, c) => a + c.charCodeAt(0), 0);

  const product: Product = {
    id: existing?.id ?? d.id ?? "",
    sku: d.sku,
    slug: existing?.slug ?? d.slug ?? "",
    name: d.name,
    brand: d.brand || existing?.brand || "",
    category,
    concerns: Array.from(new Set(concerns)),
    price: +price!.toFixed(2),
    compareAt: compareAt && compareAt > price! ? +compareAt.toFixed(2) : undefined,
    size: d.size || existing?.size || "",
    images,
    stock: stock === undefined ? existing?.stock : Math.max(0, Math.round(stock)),
    inStock: stock !== undefined ? stock > 0 : d.inStock ?? existing?.inStock ?? true,
    status,
    tags,
    description: d.description || existing?.description || "",
    howToUse: d.howToUse || existing?.howToUse || "",
    ingredients: d.ingredients || existing?.ingredients || "",
    video: d.video === undefined ? existing?.video : d.video.trim() || undefined,
    barcode: d.barcode || existing?.barcode || undefined,
    shape: existing?.shape ?? shapes[seed % shapes.length],
    color: existing?.color ?? palette[seed % palette.length],
    group: d.group || existing?.group || undefined,
    variant: d.variant || existing?.variant || undefined,
    source: d.source || existing?.source || undefined,
    photosFrom: existing?.photosFrom,
    collections: d.collections ?? existing?.collections,
  };
  return { ok: true, product, newCategories, newConcerns };
}

/** Spreadsheet columns the importer understands (first alias = template header). */
export const importFields: { key: keyof ProductInput; label: string; aliases: string[]; required?: boolean; hint?: string }[] = [
  { key: "sku", label: "SKU", aliases: ["sku", "code", "item code", "product code", "ref", "reference", "handle"], required: true },
  { key: "name", label: "Name", aliases: ["name", "title", "product name", "product", "item name", "description short"], required: true },
  { key: "price", label: "Price", aliases: ["price", "selling price", "sale price", "variant price", "unit price", "retail price"], required: true },
  { key: "compareAt", label: "Compare-at price", aliases: ["compare_at_price", "compare at price", "original price", "old price", "rrp", "msrp", "variant compare at price"], hint: "Original price, shows as a discount" },
  { key: "brand", label: "Brand", aliases: ["brand", "vendor", "manufacturer", "make"] },
  { key: "category", label: "Category", aliases: ["category", "type", "product type", "department", "collection"] },
  { key: "concerns", label: "Concerns", aliases: ["concerns", "concern", "skin concern", "benefits"], hint: "Separate with | or ," },
  { key: "size", label: "Size", aliases: ["size", "volume", "weight", "pack size", "option1 value"] },
  { key: "stock", label: "Stock", aliases: ["stock", "qty", "quantity", "inventory", "variant inventory qty", "on hand"] },
  { key: "status", label: "Status", aliases: ["status", "published", "active", "visible"], hint: "active or draft" },
  { key: "tags", label: "Tags", aliases: ["tags", "badges", "labels"], hint: "deal, mega, favorite, new, bundle, half" },
  { key: "images", label: "Image URLs", aliases: ["images", "image", "image url", "image src", "image_url", "photo", "picture"], hint: "Separate several with |" },
  { key: "description", label: "Description", aliases: ["description", "body", "body (html)", "long description", "details"] },
  { key: "howToUse", label: "How to use", aliases: ["how_to_use", "how to use", "usage", "directions"] },
  { key: "ingredients", label: "Ingredients", aliases: ["ingredients", "inci", "composition"] },
  { key: "barcode", label: "Barcode", aliases: ["barcode", "ean", "upc", "gtin", "variant barcode"] },
  { key: "group", label: "Group (variants)", aliases: ["group", "product_group", "parent", "parent sku", "handle group"], hint: "Same value = sizes/shades of one item" },
  { key: "variant", label: "Variant label", aliases: ["variant", "variant_label", "option", "option value", "variant title"], hint: "e.g. 50 ml, Black" },
  { key: "video", label: "How-to video", aliases: ["video", "video url", "how to video", "youtube", "tiktok"], hint: "YouTube / TikTok / Instagram / MP4 link" },
];

export const templateHeaders = importFields.map((f) => f.aliases[0]);

export function guessMapping(headers: string[]): Record<string, number | null> {
  const norm = (s: string) => s.toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  const map: Record<string, number | null> = {};
  const used = new Set<number>();
  for (const f of importFields) {
    const idx = headers.findIndex((h, i) => !used.has(i) && f.aliases.some((a) => norm(a) === norm(h)));
    map[f.key] = idx >= 0 ? idx : null;
    if (idx >= 0) used.add(idx);
  }
  return map;
}

/** Product → spreadsheet row (same columns as the template). */
export function productToRow(p: Product, tax: Taxonomy): string[] {
  return [
    p.sku,
    p.name,
    p.price.toFixed(2),
    p.compareAt?.toFixed(2) ?? "",
    p.brand,
    tax.categories.find((c) => c.slug === p.category)?.name ?? p.category,
    p.concerns.map((c) => tax.concerns.find((k) => k.slug === c)?.name ?? c).join(" | "),
    p.size,
    p.stock === undefined ? "" : String(p.stock),
    p.status,
    p.tags.join(" | "),
    p.images.join(" | "),
    p.description,
    p.howToUse,
    p.ingredients,
    p.barcode ?? "",
    p.group ?? "",
    p.variant ?? "",
    p.video ?? "",
  ];
}

export function toCsv(rows: string[][]): string {
  const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + rows.map((r) => r.map((c) => esc(String(c ?? ""))).join(",")).join("\r\n");
}
