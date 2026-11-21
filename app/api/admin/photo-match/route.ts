import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getIndex } from "@/lib/catalog";
import { groupsByBrand, matchPage } from "@/lib/import/photo-match";
import { fetchSourcePage, normaliseSourceUrl } from "@/lib/import/shopify-source";

export const maxDuration = 300;

// Matches ONE page of the photo-source store against the whole catalog; the admin page
// loops over pages and keeps the best suggestion per item.
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { source, page = 1, minScore = 0.75 } = (await req.json().catch(() => ({}))) as { source?: string; page?: number; minScore?: number };
  let origin: URL;
  try {
    origin = normaliseSourceUrl(String(source ?? ""));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  let products;
  try {
    products = await fetchSourcePage(origin, Math.max(1, Math.min(400, Number(page) || 1)));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
  const idx = await getIndex();
  const groups = groupsByBrand(idx.all);
  const suggestions = matchPage(groups, products, origin.origin, Math.max(0.5, Math.min(1, Number(minScore) || 0.75)));
  return NextResponse.json({ done: products.length < 250, fetched: products.length, suggestions, sourceName: origin.hostname.replace(/^www\./, "") });
}
