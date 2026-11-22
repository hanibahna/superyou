import "server-only";

// Live catalog, stored in the database and edited from /admin.
//
// Built for tens of thousands of items:
//   "p:lite"   hash  id → small record (name, brand, price, stock, first image…)
//   "p:detail" hash  id → long fields (description, how to use, ingredients, all images)
//   "p:ver"    counter bumped on every change
// Each server instance keeps the whole "lite" index in memory and only reloads it
// when p:ver changes (checked at most every few seconds), so pages stay fast.

import { randomUUID } from "node:crypto";
import { db, dbConfigured } from "@/lib/db";
import {
  defaultCategories,
  defaultConcerns,
  sampleProducts,
  slugify,
  toLite,
  type Product,
  type ProductLite,
  type Taxonomy,
} from "@/lib/data/catalog";

const LITE = "p:lite";
const DETAIL = "p:detail";
const VER = "p:ver";
const CHECK_EVERY_MS = 5000;

type Detail = Pick<Product, "description" | "howToUse" | "ingredients" | "images" | "video">;

export type Index = {
  ver: string;
  all: ProductLite[]; // sorted by name
  byId: Map<string, ProductLite>;
  bySlug: Map<string, ProductLite[]>; // a slug = one item, possibly several variants
  skuToId: Map<string, string>;
};

const g = globalThis as unknown as { __idx?: Index; __idxChecked?: number; __idxLoading?: Promise<Index>; __idxLoadingVer?: unknown; __seeded?: boolean };

async function currentVersion(): Promise<string> {
  return String((await db.cmd<string | number | null>(["GET", VER])) ?? "0");
}

// SuperYou is the dealer: customers only ever see SuperYou, never the supplier shops' names.
const SUPPLIER = /skin[\s_-]*society|neo[\s_-]*vitale/i;
const CLINIC = /^skin\s*society\s+the\s+clinic$/i;
/** Text from a supplier ("…our clients at Skin Society The Clinic…") speaks as SuperYou. */
export const asSuperYou = (t: string) => (t && SUPPLIER.test(t) ? t.replace(/skin[\s_-]*society([\s_-]+the[\s_-]+clinic)?([\s_-]+para)?|neo[\s_-]*vitale/gi, "SuperYou") : t);

/** Squashed brand key: "La Roche Posay", "La Roche-Posay" and "la roche-posay" are one brand. */
export const brandKey = (b: string) => b.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
/** Official spellings where the supplier feeds disagree with the brand's own. */
const OFFICIAL: Record<string, string> = {
  isdin: "ISDIN", aderma: "A-Derma", larocheposay: "La Roche-Posay", guylaroche: "Guy Laroche", powerofnature: "Power of Nature",
  nuxe: "NUXE", svr: "SVR", cerave: "CeraVe", nyxprofessionalmakeup: "NYX Professional Makeup", loreal: "L'Oréal", lorealparis: "L'Oréal Paris",
};
/** One spelling per brand across the catalog: the official one, else the most used. */
function canonBrands(list: ProductLite[]) {
  const counts = new Map<string, Map<string, number>>();
  for (const p of list) {
    const k = brandKey(p.brand), m = counts.get(k) ?? new Map<string, number>();
    m.set(p.brand, (m.get(p.brand) ?? 0) + 1);
    counts.set(k, m);
  }
  const pick = new Map<string, string>();
  for (const [k, m] of counts) pick.set(k, OFFICIAL[k] ?? [...m].sort((a, b) => b[1] - a[1])[0][0]);
  for (const p of list) p.brand = pick.get(brandKey(p.brand)) ?? p.brand;
}

function buildIndex(ver: string, raw: string[]): Index {
  const parsed = raw.map((r) => JSON.parse(r) as ProductLite);
  // Products a supplier sold under its own shop name get their real brand from the product name
  // when it starts with one ("Bio-Strath …"), otherwise SuperYou.
  if (parsed.some((p) => SUPPLIER.test(p.brand))) {
    const known = [...new Set(parsed.map((p) => p.brand).filter((b) => !SUPPLIER.test(b)))].sort((a, b) => b.length - a.length);
    for (const p of parsed) {
      if (!SUPPLIER.test(p.brand)) continue;
      const n = p.name.toLowerCase();
      p.brand = CLINIC.test(p.brand) ? "SuperYou Clinic" : known.find((b) => b.length >= 3 && (n.startsWith(b.toLowerCase() + " ") || n.startsWith(b.toLowerCase() + "-"))) ?? "SuperYou";
    }
  }
  for (const p of parsed) if (SUPPLIER.test(p.name)) p.name = asSuperYou(p.name);
  canonBrands(parsed);
  const all = parsed.sort((a, b) => a.name.localeCompare(b.name) || (a.price - b.price));
  const byId = new Map(all.map((p) => [p.id, p]));
  const bySlug = new Map<string, ProductLite[]>();
  for (const p of all) {
    const list = bySlug.get(p.slug);
    list ? list.push(p) : bySlug.set(p.slug, [p]);
  }
  for (const list of bySlug.values()) list.sort((a, b) => a.price - b.price);
  const skuToId = new Map(all.map((p) => [p.sku.toLowerCase(), p.id]));
  return { ver, all, byId, bySlug, skuToId };
}

/**
 * First run: an empty store is filled with the catalog built into the app
 * (data/seed-catalog.json.gz), or with demo products if there is none.
 * Runs once per database — later edits, imports and deletions are never undone.
 */
const gs = globalThis as unknown as { __seeding?: Promise<void> };

/** Resolves once first-run setup is finished (every server read waits for it). */
export function ensureSeeded(): Promise<void> {
  if (g.__seeded) return Promise.resolve();
  return (gs.__seeding ??= seedIfEmpty().finally(() => (g.__seeded = true)));
}

async function seedIfEmpty() {
  if (g.__seeded) return;
  if ((await db.cmd<number>(["HLEN", LITE])) > 0) return;
  // Only one server instance does the loading.
  if ((await db.cmd<string | null>(["SET", "seed:done", new Date().toISOString(), "NX"])) !== "OK") return;
  const seed = await readSeed();
  await saveProducts(seed ?? (dbConfigured ? [] : sampleProducts));
  await loadSiteSeed(false);
}

/**
 * Built-in store setup (menus, collections, pages, homepage, theme) from data/seed-site.json.
 * overwrite=false only fills in what isn't set yet.
 */
export async function loadSiteSeed(overwrite: boolean): Promise<string[]> {
  try {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const docs = JSON.parse(await readFile(path.join(process.cwd(), "data", "seed-site.json"), "utf8")) as Record<string, unknown>;
    const done: string[] = [];
    for (const [key, value] of Object.entries(docs)) {
      const res = await db.cmd<string | null>(overwrite ? ["SET", key, JSON.stringify(value)] : ["SET", key, JSON.stringify(value), "NX"]);
      if (res === "OK") done.push(key);
    }
    // Clear per-instance caches so the new documents show immediately.
    (globalThis as unknown as { __docs?: Map<string, unknown> }).__docs?.clear();
    (globalThis as unknown as { __tax?: unknown }).__tax = undefined;
    return done;
  } catch {
    return [];
  }
}

async function readSeed(): Promise<Product[] | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { gunzipSync } = await import("node:zlib");
    const path = await import("node:path");
    const buf = await readFile(path.join(process.cwd(), "data", "seed-catalog.json.gz"));
    return JSON.parse(gunzipSync(buf).toString("utf8")) as Product[];
  } catch {
    return null;
  }
}

/** Replace nothing, add back every product from the built-in catalog (admin action). */
export async function loadBuiltInCatalog(): Promise<number> {
  const seed = await readSeed();
  if (!seed) return 0;
  await saveProducts(seed);
  return seed.length;
}

/** The whole catalog index (cached per server instance). */
export async function getIndex(): Promise<Index> {
  await ensureSeeded();
  const now = Date.now();
  // A newer version is being loaded: wait for it rather than serve the old one.
  if (g.__idxLoading) return g.__idxLoading;
  if (g.__idx && g.__idxChecked && now - g.__idxChecked < CHECK_EVERY_MS) return g.__idx;
  const ver = await currentVersion();
  g.__idxChecked = now;
  if (g.__idx && g.__idx.ver === ver) return g.__idx;
  // A load already running for an older version must not be reused (it may miss the latest save).
  if (g.__idxLoading && g.__idxLoadingVer !== ver) g.__idxLoading = undefined;
  g.__idxLoadingVer = ver;
  g.__idxLoading ??= (async () => {
    // Read the index in chunks: one request must stay under Upstash's 10 MB limit.
    const raw: string[] = [];
    let cursor = "0";
    do {
      const [next, flat] = (await db.cmd<[string, string[]]>(["HSCAN", LITE, cursor, "COUNT", 3000])) ?? ["0", []];
      for (let i = 1; i < flat.length; i += 2) raw.push(flat[i]);
      cursor = String(next);
    } while (cursor !== "0");
    const idx = buildIndex(ver, raw);
    if (!g.__idx || Number(idx.ver) >= Number(g.__idx.ver)) g.__idx = idx;
    return idx;
  })().finally(() => (g.__idxLoading = undefined));
  return g.__idxLoading;
}

function invalidate() {
  g.__idxChecked = 0;
}

// ── Reads ───────────────────────────────────────────────────

export async function getAllProducts(): Promise<ProductLite[]> {
  return (await getIndex()).all;
}

/** Products visible on the storefront. */
export async function getProducts(): Promise<ProductLite[]> {
  return (await getIndex()).all.filter((p) => p.status === "active");
}

export async function getProductById(id: string): Promise<ProductLite | null> {
  return (await getIndex()).byId.get(id) ?? null;
}

/** All live variants of one item (cheapest first). */
export async function getGroupBySlug(slug: string): Promise<ProductLite[]> {
  return ((await getIndex()).bySlug.get(slug) ?? []).filter((p) => p.status === "active");
}

async function getDetails(ids: string[]): Promise<Map<string, Detail>> {
  const out = new Map<string, Detail>();
  for (let i = 0; i < ids.length; i += 500) {
    const part = ids.slice(i, i + 500);
    const raws = await db.pipeline(part.map((id) => ["HGET", DETAIL, id]));
    raws.forEach((r, n) => r && out.set(part[n], JSON.parse(r as string)));
  }
  return out;
}

/** Full record including long texts and every image. */
export async function getProductDetail(id: string): Promise<Product | null> {
  const lite = await getProductById(id);
  if (!lite) return null;
  return merge(lite, (await getDetails([id])).get(id));
}

export async function getProductsDetailed(ids: string[]): Promise<Product[]> {
  const idx = await getIndex();
  const details = await getDetails(ids);
  return ids.map((id) => idx.byId.get(id)).filter((p): p is ProductLite => !!p).map((p) => merge(p, details.get(p.id)));
}

function merge(lite: ProductLite, d?: Detail): Product {
  const { image, imageCount: _c, ...rest } = lite;
  return { ...rest, description: asSuperYou(d?.description ?? ""), howToUse: asSuperYou(d?.howToUse ?? ""), ingredients: d?.ingredients ?? "", images: d?.images ?? (image ? [image] : []), video: d?.video || undefined };
}

// ── Writes ──────────────────────────────────────────────────

export async function saveProducts(list: Product[]) {
  if (!list.length) return;
  const now = new Date().toISOString();
  const lite: string[] = [];
  const detail: string[] = [];
  for (const p of list) {
    const clean: Product = { ...p, inStock: p.stock === undefined ? p.inStock : p.stock > 0, updatedAt: now };
    lite.push(p.id, JSON.stringify(toLite(clean)));
    detail.push(p.id, JSON.stringify({ description: clean.description, howToUse: clean.howToUse, ingredients: clean.ingredients, images: clean.images, video: clean.video || undefined }));
  }
  // Keep each request under ~700 KB (Upstash's free plan allows 1 MB per request),
  // and send a few batches in parallel so a large first load stays quick.
  const batches: [string[], string[]][] = [];
  let bl: string[] = [], bd: string[] = [], size = 0;
  for (let i = 0; i < lite.length; i += 2) {
    const add = lite[i].length * 2 + lite[i + 1].length + detail[i + 1].length + 20;
    if (bl.length && (size + add > 700_000 || bl.length >= 800)) (batches.push([bl, bd]), (bl = []), (bd = []), (size = 0));
    bl.push(lite[i], lite[i + 1]);
    bd.push(detail[i], detail[i + 1]);
    size += add;
  }
  if (bl.length) batches.push([bl, bd]);
  for (let i = 0; i < batches.length; i += 4) {
    await Promise.all(batches.slice(i, i + 4).map(([l, d]) => db.pipeline([["HSET", LITE, ...l], ["HSET", DETAIL, ...d]])));
  }
  await db.cmd(["INCR", VER]);
  invalidate();
}

export async function deleteProducts(ids: string[]) {
  for (let i = 0; i < ids.length; i += 500) {
    const part = ids.slice(i, i + 500);
    await db.pipeline([["HDEL", LITE, ...part], ["HDEL", DETAIL, ...part]]);
  }
  await db.cmd(["INCR", VER]);
  invalidate();
}

export async function deleteAllProducts() {
  g.__seeded = true; // an emptied catalog stays empty (no sample re-seeding in local mode)
  await db.pipeline([["DEL", LITE], ["DEL", DETAIL], ["INCR", VER]]);
  invalidate();
}

export async function loadSampleProducts() {
  await saveProducts(sampleProducts);
}

/** Iterate over every product with details, in pages (for exports). */
export async function* iterateDetailed(pageSize = 500): AsyncGenerator<Product[]> {
  const all = await getAllProducts();
  for (let i = 0; i < all.length; i += pageSize) yield getProductsDetailed(all.slice(i, i + pageSize).map((p) => p.id));
}

/**
 * Give every item a unique slug. Variants of the same group share one slug;
 * a clash with a different item gets its SKU appended.
 */
export function assignSlugs(incoming: Product[], existing: Map<string, ProductLite[]>): Product[] {
  const owner = new Map<string, string>(); // slug → group key
  for (const [slug, list] of existing) owner.set(slug, list[0].group ?? list[0].id);
  const groupSlug = new Map<string, string>();
  return incoming.map((p) => {
    const key = p.group ?? p.id;
    let slug = groupSlug.get(key) ?? p.slug ?? "";
    if (!slug) slug = slugify(`${p.brand} ${p.name}`) || slugify(p.sku);
    const o = owner.get(slug);
    if (o && o !== key) slug = `${slug}-${slugify(p.group ?? p.sku) || p.id.slice(0, 6)}`;
    owner.set(slug, key);
    groupSlug.set(key, slug);
    return { ...p, slug };
  });
}

export const newId = () => randomUUID().replace(/-/g, "").slice(0, 12);

// ── Taxonomy (categories & concerns) ────────────────────────

export async function getTaxonomy(): Promise<Taxonomy> {
  await ensureSeeded();
  const raw = await db.cmd<string | null>(["GET", "taxonomy"]);
  if (raw) return JSON.parse(raw) as Taxonomy;
  return { categories: defaultCategories, concerns: defaultConcerns };
}

export async function saveTaxonomy(t: Taxonomy) {
  await db.cmd(["SET", "taxonomy", JSON.stringify(t)]);
}

export { dbConfigured };
