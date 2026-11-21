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
  return <ShopView result={result} query={query} videos={videos} category={category} />;
}
