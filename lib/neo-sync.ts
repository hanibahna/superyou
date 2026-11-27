import "server-only";
import { db } from "@/lib/db-core";
import { getIndex, getProductsDetailed, saveProducts } from "@/lib/catalog";
import { upsertProducts } from "@/lib/catalog-admin";
import { discountFor } from "@/lib/costs/neovitale";
import { fetchSourcePage, mapSourceProduct, type SourceProduct } from "@/lib/import/shopify-source";

// NeoVitale catalog sync, every 3 days (Vercel Cron → /api/cron/neo-sync/).
// Same rules as the manual work of 26 Nov 2026:
//  • price = NeoVitale's regular price (their crossed-out price when on sale), never their sale price;
//    no strike-through price, no sale badges copied from them; our own discounts are set by hand.
//  • cost = regular price × (1 − brand discount from their sheet); lines without a discount keep theirs.
//  • new products and shades are added; items with no price yet ($0) are added as sold out.
//  • availability follows NeoVitale (only for items without our own stock count).
//  • NeoVitale's own house items (gift cards, wrapping, vouchers, display material) are never added.
// Each step reads a few catalog pages; the cron route chains steps and the last one emails a report.

const STATE = "neo-sync:run";
const LAST = "neo-sync:last";
const PAGES_PER_STEP = 6;
const SKU = "NEO";
const SALE_TAGS = new Set(["mega", "half", "deal"]);
export const REPORT_TO = ["order@shopsuperyou.com", "hani.bahna@gmail.com"];

type Line = string;
type Run = {
  startedAt: string; page: number; done: boolean; seen: string[];
  added: Line[]; addedSoldOut: Line[]; priceUp: Line[]; priceDown: Line[]; costFixed: number;
  backInStock: Line[]; nowSoldOut: Line[]; gone: Line[]; errors: string[]; finishedAt?: string; retries?: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const label = (p: { brand: string; name: string; variant?: string }) => `${p.brand} · ${p.name}${p.variant ? ` · ${p.variant}` : ""}`;

async function load(): Promise<Run | null> {
  const s = await db.cmd<string | null>(["GET", STATE]);
  return s ? (JSON.parse(s) as Run) : null;
}
const save = (r: Run) => db.cmd(["SET", STATE, JSON.stringify(r), "EX", 86400]);

export async function startSync() {
  const r: Run = { startedAt: new Date().toISOString(), page: 1, done: false, seen: [], added: [], addedSoldOut: [], priceUp: [], priceDown: [], costFixed: 0, backInStock: [], nowSoldOut: [], gone: [], errors: [] };
  await save(r);
  return r;
}

async function page(n: number): Promise<SourceProduct[]> {
  for (let a = 0; ; a++) {
    try { return await fetchSourcePage(new URL("https://neovitale.com"), n); } catch (e) {
      if (a >= 3) throw e;
      await new Promise((res) => setTimeout(res, 6000 * (a + 1))); // NeoVitale limits how fast we can read
    }
  }
}

const houseItem = (p: SourceProduct) => /gift card|posm/i.test(p.product_type) || /^neo ?vitale$/i.test(p.vendor.trim());

/** One step: a few catalog pages. Returns whether more remain. */
export async function stepSync(): Promise<{ more: boolean }> {
  const run = await load();
  if (!run || run.done) return { more: false };
  const idx = await getIndex();
  // Duplicates hidden by /api/admin/neo-dupes (a cheaper copy is sold instead): left as they are.
  const dupes = new Set((await db.cmd<string[] | null>(["SMEMBERS", "neo:dupes"]).catch(() => null)) ?? []);
  const { brandName } = await import("@/lib/brand-names");
  const known = brandName(idx.all);
  const seen = new Set(run.seen);
  let last = false;
  const t0 = Date.now();
  for (let i = 0; i < PAGES_PER_STEP && Date.now() - t0 < 90000; i++) {
    let list: SourceProduct[];
    try { list = await page(run.page); } catch (e) {
      // Rate-limited: try the same page again in the next step (up to 3 times), then give up.
      run.retries = (run.retries ?? 0) + 1;
      if (run.retries >= 3) { run.errors.push(`stopped at catalog page ${run.page}: ${(e as Error).message}`); run.done = true; }
      break;
    }
    if (!list.length) { last = true; break; }
    run.page++;
    run.retries = 0;
    const fresh: SourceProduct[] = [];
    const updates = new Map<string, { price?: number; cost?: number; inStock?: boolean }>();
    for (const p of list) {
      if (houseItem(p)) continue;
      const newVariants = p.variants.filter((v) => !idx.skuToId.has(`${SKU}-${v.id}`.toLowerCase()));
      if (newVariants.length) fresh.push({ ...p, variants: newVariants });
      for (const v of p.variants) {
        seen.add(String(v.id));
        const id = idx.skuToId.get(`${SKU}-${v.id}`.toLowerCase());
        const ours = id ? idx.byId.get(id) : undefined;
        if (!ours || ours.source !== "neovitale.com" || dupes.has(ours.id)) continue;
        const price = Number(v.price), was = v.compare_at_price ? Number(v.compare_at_price) : 0;
        const base = r2(was > price ? was : price);
        const pct = discountFor(ours.brand, ours.name);
        const u: { price?: number; cost?: number; inStock?: boolean } = {};
        if (base > 0 && (Math.abs(ours.price - base) > 0.005 || ours.compareAt)) {
          u.price = base;
          if (base > ours.price + 0.005) run.priceUp.push(`${label(ours)}: $${ours.price} → $${base}`);
          else if (base < ours.price - 0.005) run.priceDown.push(`${label(ours)}: $${ours.price} → $${base}`);
        }
        if (typeof pct === "number" && base > 0) {
          const cost = r2(base * (1 - pct / 100));
          if (Math.abs((ours.cost ?? -1) - cost) > 0.005) { u.cost = cost; run.costFixed++; }
        }
        if (ours.stock === undefined) {
          const avail = v.available && base > 0;
          if (avail !== ours.inStock) { u.inStock = avail; (avail ? run.backInStock : run.nowSoldOut).push(label(ours)); }
        }
        if (Object.keys(u).length) updates.set(ours.id, u);
      }
    }
    if (updates.size) {
      const ids = [...updates.keys()];
      for (let k = 0; k < ids.length; k += 400) {
        const part = await getProductsDetailed(ids.slice(k, k + 400));
        await saveProducts(part.map((p) => {
          const u = updates.get(p.id)!;
          return { ...p, ...(u.price !== undefined ? { price: u.price, compareAt: undefined, tags: (p.tags ?? []).filter((t) => !SALE_TAGS.has(t)) } : {}), ...(u.cost !== undefined ? { cost: u.cost } : {}), ...(u.inStock !== undefined ? { inStock: u.inStock } : {}) };
        }));
      }
    }
    if (fresh.length) {
      const rows = fresh.flatMap((p) => mapSourceProduct(p, { adjustPct: 0, round: "cents", asDraft: false, skuPrefix: SKU, sourceName: "neovitale.com" }));
      for (const row of rows) {
        row.brand = known(String(row.brand));
        const pct = discountFor(String(row.brand), String(row.name));
        if (typeof pct === "number" && Number(row.price) > 0) row.cost = r2(Number(row.price) * (1 - pct / 100));
      }
      if (rows.length) {
        const rep = await upsertProducts(rows);
        if (rep.errors.length) run.errors.push(...rep.errors.slice(0, 5).map((e) => JSON.stringify(e).slice(0, 200)));
        for (const row of rows) (Number(row.price) > 0 ? run.added : run.addedSoldOut).push(label({ brand: String(row.brand), name: String(row.name), variant: row.variant as string | undefined }) + (Number(row.price) > 0 ? ` · $${row.price}` : ""));
      }
    }
  }
  run.seen = [...seen];
  if (last) {
    // Items NeoVitale no longer lists: marked sold out (only after a complete read with no errors).
    if (!run.errors.length) {
      const goneIds = idx.all.filter((p) => p.source === "neovitale.com" && p.stock === undefined && p.inStock && !seen.has((p.sku ?? "").split("-").pop() ?? ""));
      for (let k = 0; k < goneIds.length; k += 400) {
        const part = await getProductsDetailed(goneIds.slice(k, k + 400).map((p) => p.id));
        await saveProducts(part.map((p) => ({ ...p, inStock: false })));
      }
      run.gone = goneIds.map(label);
    }
    run.done = true;
  }
  if (run.done) {
    run.finishedAt = new Date().toISOString();
    run.seen = [];
    if (run.backInStock.length) await (await import("@/lib/stock-alerts")).sendStockAlerts().catch(() => 0);
    await db.cmd(["SET", LAST, JSON.stringify(run), "EX", 60 * 86400]);
    await sendReport(run);
  }
  await save(run);
  return { more: !run.done };
}

function section(title: string, lines: Line[], max = 60) {
  if (!lines.length) return `${title}: none\n`;
  return `${title}: ${lines.length}\n${lines.slice(0, max).map((l) => `  - ${l}`).join("\n")}${lines.length > max ? `\n  … and ${lines.length - max} more` : ""}\n`;
}

export function reportText(r: Run) {
  return [
    `NeoVitale catalog sync — ${r.finishedAt?.slice(0, 16).replace("T", " ")} UTC`,
    `Rules: regular price (their sale prices not copied), cost = regular price less the line discount, new items added, $0 items added as sold out.`,
    r.errors.length ? `\nPROBLEMS (the sync may be incomplete):\n${r.errors.map((e) => `  - ${e}`).join("\n")}\n` : "",
    section("New products added", r.added),
    section("New items added as sold out (no price yet)", r.addedSoldOut),
    section("Prices raised to NeoVitale's regular price", r.priceUp),
    section("Prices lowered to NeoVitale's regular price", r.priceDown),
    `Costs corrected: ${r.costFixed}\n`,
    section("Back in stock", r.backInStock),
    section("Now sold out", r.nowSoldOut),
    section("No longer listed by NeoVitale (marked sold out)", r.gone),
  ].join("\n");
}

export async function sendReport(r: Run): Promise<boolean[]> {
  const { sendEmail } = await import("@/lib/email");
  const subject = `Catalog sync: ${r.added.length + r.addedSoldOut.length} new, ${r.priceUp.length + r.priceDown.length} price changes${r.errors.length ? " (incomplete)" : ""}`;
  const text = reportText(r);
  const out: boolean[] = [];
  for (const to of REPORT_TO) out.push(await sendEmail(to, subject, text).catch(() => false));
  return out;
}

export async function lastSync(): Promise<Run | null> {
  const s = await db.cmd<string | null>(["GET", LAST]);
  return s ? (JSON.parse(s) as Run) : null;
}
export async function currentSync() { return load(); }
