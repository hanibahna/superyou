import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getAllProducts, getProductsDetailed, saveProducts } from "@/lib/catalog";
import { cleanImage, cleanStats } from "@/lib/image-clean";

// Admin: remove discount overlays from supplier photos, a batch per call (run again until "left" is 0).
// POST {source?: "neovitale.com", dry?: boolean, seconds?: number}
export const maxDuration = 300;

export async function GET() {
  const denied = await adminGuard("catalog");
  if (denied) return denied;
  return NextResponse.json(await cleanStats());
}

export async function POST(req: NextRequest) {
  const denied = await adminGuard("catalog");
  if (denied) return denied;
  const { source = "neovitale.com", dry = false, seconds = 240, only } = (await req.json().catch(() => ({}))) as { source?: string; dry?: boolean; seconds?: number; only?: string[] };
  const stop = Date.now() + Math.min(280, Math.max(20, seconds)) * 1000;
  const ids = (await getAllProducts()).filter((p) => (p.source ?? "").toLowerCase() === source.toLowerCase() && (!only || only.includes(p.id))).map((p) => p.id);
  let done = 0, fixedNow = 0, saved = 0, left = 0;
  const manual: { id: string; name: string; why?: string }[] = [];
  const errors: string[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const prods = await getProductsDetailed(ids.slice(i, i + 50));
    // 8 products at a time, each with all its photos at once.
    for (let k = 0; k < prods.length; k += 8) {
      if (Date.now() > stop) { left += prods.slice(k).filter((p) => p.images.some((u) => /^https?:\/\//.test(u) && !u.includes("blob.vercel-storage.com"))).length; continue; }
      await Promise.all(prods.slice(k, k + 8).map(async (p) => {
        const imgs = p.images.filter((u) => /^https?:\/\//.test(u) && !u.includes("blob.vercel-storage.com"));
        if (!imgs.length) return;
        const results = await Promise.all(imgs.map((u) => cleanImage(u, { dry })));
        done += results.length;
        results.forEach((r) => { if (r.status === "manual") manual.push({ id: p.id, name: `${p.brand} ${p.name}`, why: r.why }); if (r.status === "error") errors.push(`${p.id}: ${r.why}`); });
        if (results.some((r) => r.status === "error")) left++;
        if (dry) { fixedNow += results.filter((r) => r.status === "fixed").length; return; }
        const map = new Map<string, string>();
        imgs.forEach((u, n) => { const r = results[n]; if (r.status === "fixed" && r.out) map.set(u, r.out); });
        if (map.size) {
          fixedNow += map.size;
          // Cleaned photos replace the originals and are kept on re-import.
          await saveProducts([{ ...p, images: p.images.map((u) => map.get(u) ?? u), photosFrom: p.photosFrom || "cleaned" }]);
          saved++;
        }
      }));
    }
  }
  return NextResponse.json({ products: ids.length, imagesChecked: done, fixed: fixedNow, productsUpdated: saved, left, manual: manual.slice(0, 200), errors: errors.slice(0, 20), totals: await cleanStats() });
}
