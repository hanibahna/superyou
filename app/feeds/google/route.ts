import { getProductsDetailed } from "@/lib/catalog";
import { liveProducts } from "@/lib/pricing";
import { siteUrl } from "@/lib/seo";
import { getSettings } from "@/lib/site-store";

// Free Google Shopping feed for Merchant Center: add  https://<your domain>/feeds/google  as a
// scheduled fetch (daily). One item per size/shade; sizes of a product share item_group_id.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

// Streamed in batches (the full feed is ~50 MB), so it never has to sit in memory at once.
export async function GET() {
  const [live, settings] = await Promise.all([liveProducts(), getSettings()]);
  const base = siteUrl();
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
  ctl.enqueue(enc.encode(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>
<title>${esc(settings.store.name)}</title><link>${base}</link><description>${esc(settings.store.tagline)}</description>
`));
  for (let i = 0; i < live.list.length; i += 500) {
    const items: string[] = [];
    const chunk = live.list.slice(i, i + 500);
    const details = new Map((await getProductsDetailed(chunk.map((p) => p.id))).map((d) => [d.id, d]));
    for (const p of chunk) {
      const d = details.get(p.id);
      const image = p.image ?? d?.images?.[0];
      if (!image) continue; // Google requires an image
      const sale = p.compareAt && p.compareAt > p.price;
      const title = `${p.brand} ${p.name}${p.variant ? ` - ${p.variant}` : p.size ? ` ${p.size}` : ""}`.slice(0, 150);
      items.push(`<item>
<g:id>${esc(p.sku)}</g:id><g:title>${esc(title)}</g:title>
<g:description>${esc((d?.description || title).slice(0, 4900))}</g:description>
<g:link>${base}/products/${p.slug}/?v=${p.id}</g:link><g:image_link>${esc(image)}</g:image_link>
${(d?.images ?? []).slice(1, 6).map((u) => `<g:additional_image_link>${esc(u)}</g:additional_image_link>`).join("")}
<g:availability>${p.inStock ? "in_stock" : "out_of_stock"}</g:availability><g:condition>new</g:condition>
<g:price>${(sale ? p.compareAt! : p.price).toFixed(2)} USD</g:price>${sale ? `<g:sale_price>${p.price.toFixed(2)} USD</g:sale_price>` : ""}
<g:brand>${esc(p.brand)}</g:brand>${p.barcode ? `<g:gtin>${esc(p.barcode)}</g:gtin>` : "<g:identifier_exists>no</g:identifier_exists>"}
<g:item_group_id>${esc(p.slug)}</g:item_group_id><g:google_product_category>469</g:google_product_category><g:product_type>${esc(p.category)}</g:product_type>
<g:shipping><g:country>LB</g:country><g:price>${settings.delivery.fee.toFixed(2)} USD</g:price></g:shipping>
</item>`);
    }
    ctl.enqueue(enc.encode(items.join("\n") + "\n"));
  }
  ctl.enqueue(enc.encode("</channel></rss>"));
  ctl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600" } });
}
