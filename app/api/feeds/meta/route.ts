import { getTaxonomy } from "@/lib/catalog";
import { liveProducts } from "@/lib/pricing";
import { siteUrl } from "@/lib/seo";

// Product feed for Meta Commerce Manager (Instagram Shop and Facebook Shop), as CSV.
// Paste https://www.shopsuperyou.com/api/feeds/meta/ into Commerce Manager › Catalog › Data sources › Scheduled feed.
// Selling prices only: no cost, supplier or source ever goes in it.
export const revalidate = 3600;
export const maxDuration = 120;

// Google product categories (Meta uses the same list).
const GPC: [RegExp, number][] = [
  [/sun/i, 567], [/skin|face/i, 567], [/make ?up|cosmetic/i, 477], [/nail/i, 478], [/fragrance|perfume/i, 479],
  [/hair/i, 486], [/body|bath/i, 474], [/supplement|vitamin|nutrition|protein/i, 525], [/oral|dental|teeth/i, 526],
  [/baby|mom|mother/i, 537], [/health|medical|pharma/i, 491], [/men/i, 473],
];
const cell = (v: unknown) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const usd = (n: number) => `${n.toFixed(2)} USD`;
const gtinOk = (b?: string) => !!b && /^\d{8}$|^\d{12,14}$/.test(b);

export async function GET() {
  const base = siteUrl();
  const [live, tax] = await Promise.all([liveProducts(), getTaxonomy()]);
  const catName = new Map(tax.categories.map((c) => [c.slug, c.name]));
  const head = ["id", "title", "description", "availability", "condition", "price", "sale_price", "link", "image_link", "brand", "google_product_category", "product_type", "item_group_id", "size", "gtin", "quantity_to_sell_on_facebook"];
  const rows = [head.join(",")];
  for (const p of live.list) {
    if (!p.image || !p.price) continue;
    const cat = catName.get(p.category) ?? p.category ?? "";
    const gpc = GPC.find(([re]) => re.test(cat))?.[1] ?? 469; // 469 = Health & Beauty
    const img = p.image.startsWith("http") ? p.image : `${base}${p.image.startsWith("/") ? "" : "/"}${p.image}`;
    const title = `${p.brand} ${p.name}${p.size && !p.name.includes(p.size) ? ` ${p.size}` : ""}`.slice(0, 150);
    const desc = `${p.brand} ${p.name}${p.size ? `, ${p.size}` : ""}. 100% original from official distributors in Lebanon. Delivered across Lebanon, pay when it arrives.`;
    // Was-price only when it's a real reduction (sale or SuperPrice).
    const was = p.compareAt && p.compareAt > p.price + 0.01 ? p.compareAt : p.matchWas && p.matchWas > p.price + 0.01 ? p.matchWas : 0;
    rows.push([
      p.id, title, desc, p.inStock ? "in stock" : "out of stock", "new",
      usd(was || p.price), was ? usd(p.price) : "",
      `${base}/products/${p.slug}/`, img, p.brand, gpc, cat, p.group || "", p.variant || p.size || "",
      gtinOk(p.barcode) ? p.barcode : "", typeof p.stock === "number" ? Math.max(0, p.stock) : "",
    ].map(cell).join(","));
  }
  return new Response(rows.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
