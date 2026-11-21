import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { deleteProducts, getAllProducts } from "@/lib/catalog";

// After a full import: remove products from that source that the store no longer lists.
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { sourceName, keepSkus } = (await req.json().catch(() => ({}))) as { sourceName?: string; keepSkus?: string[] };
  if (!sourceName || !Array.isArray(keepSkus) || keepSkus.length === 0) return NextResponse.json({ error: "Nothing to compare against" }, { status: 400 });
  const keep = new Set(keepSkus.map((s) => s.toLowerCase()));
  const gone = (await getAllProducts()).filter((p) => p.source === sourceName && !keep.has(p.sku.toLowerCase())).map((p) => p.id);
  await deleteProducts(gone);
  return NextResponse.json({ removed: gone.length });
}
