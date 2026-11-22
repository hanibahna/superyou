import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { deleteProducts, getIndex, getProductsDetailed, saveProducts } from "@/lib/catalog";
import { upsertProducts } from "@/lib/catalog-admin";

// Create or update one product (from the editor).
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const r = await upsertProducts([body]);
  if (r.errors.length) return NextResponse.json({ error: r.errors[0].errors.join("; ") }, { status: 400 });
  return NextResponse.json({ product: r.products[0] });
}

// Bulk actions: { action: "delete" | "activate" | "draft", ids: string[] }
export async function PATCH(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { action?: string; ids?: string[]; skus?: string[] };
  const { action } = body;
  let ids = body.ids;
  // Or by SKU (bulk clean-ups after an import).
  if (!ids?.length && Array.isArray(body.skus) && body.skus.length) {
    const want = new Set(body.skus.map((s) => s.toLowerCase()));
    ids = (await getIndex()).all.filter((p) => want.has(p.sku.toLowerCase())).map((p) => p.id);
  }
  if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ error: "No products selected" }, { status: 400 });
  if (action === "delete") {
    await deleteProducts(ids);
  } else if (action === "activate" || action === "draft") {
    const changed = (await getProductsDetailed(ids)).map((p) => ({ ...p, status: action === "activate" ? ("active" as const) : ("draft" as const) }));
    await saveProducts(changed);
  } else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  return NextResponse.json({ ok: true, count: ids.length });
}
