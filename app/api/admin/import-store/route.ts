import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { getIndex } from "@/lib/catalog";
import { upsertProducts } from "@/lib/catalog-admin";
import { fetchSourcePage, mapSourceProduct, normaliseSourceUrl, type SourceProduct } from "@/lib/import/shopify-source";
import { getSourcing } from "@/lib/site-store";

export const maxDuration = 300;

const schema = z.object({
  source: z.string().min(3).max(200),
  page: z.number().int().min(1).max(400),
  adjustPct: z.number().min(-50).max(100).default(0),
  round: z.enum(["cents", "quarter", "none"]).default("cents"),
  asDraft: z.boolean().default(false),
  skuPrefix: z.string().regex(/^[A-Z0-9]{2,8}$/).default("SRC"),
  // When the server can't reach the store (bot check), the admin page sends the page it fetched itself.
  products: z.array(z.any()).max(250).optional(),
});

// Imports ONE page (up to 250 source products) per call; the admin page loops until done.
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const o = parsed.data;
  let origin: URL;
  try {
    origin = normaliseSourceUrl(o.source);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  let products: SourceProduct[];
  if (o.products) products = o.products as SourceProduct[];
  else try {
    products = await fetchSourcePage(origin, o.page);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
  if (!products.length) return NextResponse.json({ done: true, fetched: 0, rows: 0, created: 0, updated: 0, errors: [], skus: [], categories: {} });

  const sourceName = origin.hostname.replace(/^www\./, "");
  // International catalogs (Admin → Sourcing) are priced at landed cost: freight, duty, fees, VAT and margin.
  const rule = (await getSourcing()).sources.find((s) => s.source.toLowerCase() === sourceName.toLowerCase());
  const landedPricing = rule?.origin === "international" ? rule.pricing : undefined;
  const rows = products.flatMap((p) => mapSourceProduct(p, { adjustPct: o.adjustPct, round: o.round, asDraft: o.asDraft, skuPrefix: o.skuPrefix, sourceName, landed: landedPricing }));
  // Products whose photos were replaced from another store keep those photos.
  const idx = await getIndex();
  for (const row of rows) {
    const id = idx.skuToId.get(String(row.sku).toLowerCase());
    if (id && idx.byId.get(id)?.photosFrom) delete row.images;
  }
  const r = await upsertProducts(rows);
  const categories: Record<string, number> = {};
  for (const row of rows) categories[String(row.category)] = (categories[String(row.category)] ?? 0) + 1;
  return NextResponse.json({
    done: products.length < 250,
    fetched: products.length,
    rows: rows.length,
    created: r.created,
    updated: r.updated,
    errors: r.errors.slice(0, 20),
    errorCount: r.errors.length,
    skus: rows.map((x) => x.sku),
    categories,
    sourceName,
    pricing: landedPricing ? "landed" : "adjusted",
  });
}
