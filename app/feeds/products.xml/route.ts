import { createHash } from "node:crypto";
import { liveProducts } from "@/lib/pricing";
import { getTaxonomy } from "@/lib/catalog";
import { getSettings } from "@/lib/site-store";
import { siteUrl } from "@/lib/site-url";

// Product feed for Google Merchant Center (Shopping & Performance Max), Meta catalog and TikTok catalog:
// all three read this RSS 2.0 / g: format. Only what shoppers see: no supplier, no cost.
export const revalidate = 3600;

const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

const SUPPLIER = /skin-?society|neo-?vitale|beauty-?joint/i;
// Group keys carry the catalog's prefix; the feed gets a neutral id instead.
const groupId = (g: string) => createHash("sha1").update(g).digest("hex").slice(0, 12);

export async function GET() {
  const [live, settings, tax] = await Promise.all([liveProducts(), getSettings(), getTaxonomy().catch(() => null)]);
  const base = siteUrl();
  const catName = new Map((tax?.categories ?? []).map((c) => [c.slug, c.name]));
  const abs = (u?: string) => (!u ? "" : u.startsWith("http") ? u : `${base}${u.startsWith("/") ? "" : "/"}${u}`);
  const items = live.list
    // Supplier names must never show: skip pictures whose file name carries one.
    .filter((p) => p.price > 0 && p.image && !SUPPLIER.test(p.image))
    .map((p) => {
      const sale = p.compareAt && p.compareAt > p.price;
      const title = [p.brand, p.name, p.variant].filter(Boolean).join(" ").slice(0, 150);
      const desc = `${p.name}${p.variant ? ` – ${p.variant}` : ""} by ${p.brand}. Original product${p.origin === "international" ? ", imported for you with shipping, customs and VAT included" : ", delivered across Lebanon"}. Cash on delivery available.`;
      return `<item>
<g:id>${esc(p.id)}</g:id>
<g:title>${esc(title)}</g:title>
<g:description>${esc(desc)}</g:description>
<g:link>${esc(`${base}/products/${p.slug}/`)}</g:link>
<g:image_link>${esc(abs(p.image))}</g:image_link>
<g:availability>${p.inStock ? "in_stock" : "out_of_stock"}</g:availability>
<g:price>${(sale ? p.compareAt! : p.price).toFixed(2)} USD</g:price>${sale ? `\n<g:sale_price>${p.price.toFixed(2)} USD</g:sale_price>` : ""}
<g:brand>${esc(p.brand)}</g:brand>${p.barcode ? `\n<g:gtin>${esc(p.barcode)}</g:gtin>` : "\n<g:identifier_exists>no</g:identifier_exists>"}
<g:condition>new</g:condition>
<g:item_group_id>${groupId(p.group || p.slug)}</g:item_group_id>
<g:product_type>${esc(catName.get(p.category) ?? p.category)}</g:product_type>
<g:google_product_category>469</g:google_product_category>
<g:custom_label_0>${p.origin === "international" ? "imported" : "local"}</g:custom_label_0>
<g:shipping><g:country>LB</g:country><g:price>${(settings.delivery?.fee ?? 0).toFixed(2)} USD</g:price></g:shipping>
</item>`;
    });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>
<title>${esc(settings.store.name)}</title><link>${esc(base)}</link><description>${esc(settings.store.tagline || settings.store.name)}</description>
${items.join("\n")}
</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
