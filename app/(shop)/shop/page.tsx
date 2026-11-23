import { fullName } from "@/lib/data/catalog";
import { getLang } from "@/lib/i18n-server";
import { translateDeep, translateMany } from "@/lib/translate";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canonical } from "@/lib/seo";
import { getTaxonomy } from "@/lib/catalog";
import { queryShop } from "@/lib/listing";
import { redirectFor } from "@/lib/search";
import { getSearchSettings } from "@/lib/site-store";
import { parseQuery, videosFor, type SP } from "@/lib/shop-query";
import { sectionFor } from "@/lib/extras";
import { listingTips } from "@/lib/tips";
import { ShopView } from "./ShopView";

// Category, brand and concern listings get their own title, description and canonical address;
// searches and filter combinations are kept out of Google's index.
export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const q = parseQuery(await searchParams);
  const tax = await getTaxonomy();
  const cat = tax.categories.find((c) => c.slug === q.category);
  const qb = q.brand ?? [], qc = q.concern ?? [];
  const brand = qb.length === 1 ? qb[0] : "";
  const concern = qc.length === 1 ? tax.concerns.find((c) => c.slug === qc[0]) : undefined;
  const filters = qc.length + qb.length + (q.category ? 1 : 0);
  const name = [brand, concern?.name, cat?.name].filter(Boolean).join(" ") || "All products";
  const path = brand && filters === 1 ? `/shop/?brand=${encodeURIComponent(brand)}` : cat && filters === 1 ? `/shop/?category=${cat.slug}` : concern && filters === 1 ? `/shop/?concern=${concern.slug}` : "/shop/";
  return {
    title: q.q ? `Search: ${q.q}` : `${name} in Lebanon`,
    description: (cat?.description || `Shop ${name} at SuperYou: authentic products from a licensed Lebanese pharmacy, pharmacist advice on WhatsApp and delivery across Lebanon.`).slice(0, 160),
    ...(await canonical(path)),
    ...(q.q || filters > 1 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<SP> }) {
  const query = parseQuery(await searchParams);
  if (query.q) {
    const to = redirectFor(query.q, await getSearchSettings());
    if (to) redirect(to);
  }
  const lang = await getLang();
  const [raw, videos, tax] = await Promise.all([queryShop(query), videosFor(query), getTaxonomy().then((t) => translateDeep(t, lang, ["name", "description"]))]);
  const result = { ...raw, facets: await translateDeep(raw.facets, lang, ["name"]), taxonomy: tax };
  const category = tax.categories.find((c) => c.slug === query.category);
  const concern = query.concern?.length === 1 ? tax.concerns.find((c) => c.slug === query.concern![0]) : undefined;
  const base = await sectionFor(query.category, concern?.group);
  // Tips follow the filters: each selected concern, then the category, then Men / Women.
  const picked = (query.concern ?? []).flatMap((s) => [s, tax.concerns.find((c) => c.slug === s)?.name]);
  const tips = listingTips(result.items, [...picked, query.category, tax.categories.find((c) => c.slug === query.category)?.name, query.for === "men" ? "men" : undefined, query.q]);
  const section = base ? { ...base, tips: tips.length ? tips : base.tips } : null;
  // Structured data for search engines and AI assistants: the products on this list, and where it sits.
  const site = (await import("@/lib/seo")).siteUrl();
  const label = [query.brand?.length === 1 ? query.brand[0] : "", concern?.name, category?.name].filter(Boolean).join(" ") || "All products";
  const ld = [
    { "@context": "https://schema.org", "@type": "ItemList", name: `${label} at SuperYou`, numberOfItems: result.total ?? result.items.length, itemListElement: result.items.slice(0, 24).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${site}/products/${p.slug}/`, name: `${fullName(p.brand, p.name)}` })) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${site}/` }, { "@type": "ListItem", position: 2, name: "Shop", item: `${site}/shop/` }, ...(label !== "All products" ? [{ "@type": "ListItem", position: 3, name: label }] : [])] },
  ];
  return (
    <>
      {!query.q && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />}
      <ShopView result={result} query={query} videos={videos} category={category} section={section} />
    </>
  );
}
