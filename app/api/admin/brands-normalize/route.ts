import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getIndex, getProductsDetailed, saveProducts } from "@/lib/catalog";
import { brandName } from "@/lib/brand-names";

export const maxDuration = 300;

// One brand spelling everywhere: fixes the products of one catalog ({ source }) or all of them.
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { source } = (await req.json().catch(() => ({}))) as { source?: string };
  const idx = await getIndex();
  const fix = brandName(idx.all);
  const ids = idx.all.filter((p) => (!source || p.source === source) && fix(p.brand) !== p.brand).map((p) => p.id);
  for (let i = 0; i < ids.length; i += 500) {
    const part = await getProductsDetailed(ids.slice(i, i + 500));
    await saveProducts(part.map((p) => ({ ...p, brand: fix(p.brand) })));
  }
  return NextResponse.json({ changed: ids.length });
}
