import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { getIndex, getProductsDetailed, saveProducts } from "@/lib/catalog";

const schema = z.object({
  sourceName: z.string().min(3).max(100),
  items: z.array(z.object({ slug: z.string().min(1), images: z.array(z.string().url()).min(1).max(8) })).max(500),
});

// Replaces the photos of the given items and marks them so store re-imports keep them.
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { sourceName, items } = parsed.data;
  const idx = await getIndex();
  const updated = [];
  for (const it of items) {
    const ids = (idx.bySlug.get(it.slug) ?? []).map((p) => p.id);
    for (const p of await getProductsDetailed(ids)) updated.push({ ...p, images: it.images, photosFrom: sourceName });
  }
  await saveProducts(updated);
  return NextResponse.json({ items: items.length, products: updated.length });
}
