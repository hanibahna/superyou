import { put } from "@vercel/blob";
import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getAllProducts, getProductsDetailed, saveProducts } from "@/lib/catalog";
import { imgUrl } from "@/lib/img";

export const maxDuration = 300;

const isOurs = (src: string) => /\.blob\.vercel-storage\.com\//.test(src);

/**
 * Copies product photos from another site into this shop's own Vercel Blob storage,
 * a few products per call. Body: { cursor?: number, limit?: number, mainOnly?: boolean }
 */
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Connect a Vercel Blob store first (Storage → Create → Blob)." }, { status: 501 });
  // skip = products that already failed in earlier rounds (they stay first in the list)
  const { skip = 0, limit = 15, mainOnly = true } = (await req.json().catch(() => ({}))) as { skip?: number; limit?: number; mainOnly?: boolean };

  const all = (await getAllProducts()).filter((p) => p.image && !isOurs(p.image));
  const batch = all.slice(skip, skip + Math.min(40, limit));
  const full = await getProductsDetailed(batch.map((p) => p.id));
  const cache = new Map<string, string>(); // variants often share photos
  let copied = 0, failed = 0;

  for (const p of full) {
    const targets = mainOnly ? p.images.slice(0, 1) : p.images.slice(0, 6);
    const next = [...p.images];
    for (let i = 0; i < targets.length; i++) {
      const src = targets[i];
      if (isOurs(src)) continue;
      try {
        let url = cache.get(src);
        if (!url) {
          const res = await fetch(imgUrl(src, 1200)!, { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          const type = res.headers.get("content-type") ?? "image/jpeg";
          const ext = type.includes("webp") ? "webp" : type.includes("png") ? "png" : "jpg";
          const blob = await put(`products/${p.slug}-${i}.${ext}`, await res.arrayBuffer(), { access: "public", addRandomSuffix: true, contentType: type });
          url = blob.url;
          cache.set(src, url);
          copied++;
        }
        next[i] = url;
      } catch {
        failed++;
      }
    }
    p.images = next;
  }
  await saveProducts(full);
  const failedProducts = full.filter((p) => p.images[0] && !isOurs(p.images[0])).length;
  // Not yet tried: everything after this batch (earlier failures are skipped by the caller).
  const remaining = Math.max(0, all.length - skip - batch.length);
  return NextResponse.json({ processed: batch.length, copied, failed, failedProducts, remaining, done: batch.length === 0 });
}
