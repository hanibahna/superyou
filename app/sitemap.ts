import type { MetadataRoute } from "next";
import { liveNav } from "@/lib/live-nav";
import { foreignPage, pageProducts } from "@/lib/info-pages";
import { getTaxonomy } from "@/lib/catalog";
import { liveProducts } from "@/lib/pricing";
import { siteUrl } from "@/lib/seo";
import { getCollections, getSettings } from "@/lib/site-store";

// One sitemap with every live product page, collection, category, brand and info page.
// (Google accepts up to 50,000 URLs per sitemap; the shop has about 22,000.)
export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [live, cols, tax, settings] = await Promise.all([liveProducts(), getCollections(), getTaxonomy(), getSettings()]);
  const nav = await liveNav(); // only categories and collections with something on sale
  const now = new Date();
  const products = new Map<string, Date>();
  for (const p of live.list) {
    const d = p.updatedAt ? new Date(p.updatedAt) : now;
    if (!products.has(p.slug) || d > products.get(p.slug)!) products.set(p.slug, d);
  }
  const brands = [...new Set(live.list.map((p) => p.brand))];
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1, alternates: { languages: { fr: `${base}/fr/`, ar: `${base}/ar/` } } },
    ...["/shop/", "/brands/", "/routine/", ...(process.env.ANTHROPIC_API_KEY ? ["/skin-scan/"] : []), "/shade-finder/", "/services/", "/club/"].map((u) => ({ url: base + u, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...tax.categories.filter((c) => nav.categories.has(c.slug)).map((c) => ({ url: `${base}/shop/?category=${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...cols.items.filter((c) => !c.hidden && nav.collections.has(c.key.toLowerCase())).map((c) => ({ url: `${base}/collections/${c.key}/`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...brands.map((b) => ({ url: `${base}/shop/?brand=${encodeURIComponent(b)}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    // Only pages that show something real: our own pages, and brand/range pages with products on sale.
    ...(await Promise.all(Object.entries(settings.pages).filter(([k]) => !foreignPage(k)).map(async ([k, p]) => (["delivery", "payment", "rewards", "about", "privacy", "contact", "return-policy", "privacy-policy", "delivery-terms", "terms-conditions"].includes(k) || (await pageProducts(k, p.title)) ? k : null))))
      .filter((k): k is string => !!k)
      .map((k) => ({ url: `${base}/pages/${k}/`, changeFrequency: "monthly" as const, priority: 0.3 })),
    ...[...products].map(([slug, d]) => ({ url: `${base}/products/${slug}/`, lastModified: d, changeFrequency: "weekly" as const, priority: 0.6, alternates: { languages: { fr: `${base}/fr/products/${slug}/`, ar: `${base}/ar/products/${slug}/` } } })),
  ];
}
