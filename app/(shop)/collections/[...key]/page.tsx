import { getLang } from "@/lib/i18n-server";
import { shopImg } from "@/lib/img";
import { translateDeep, translateMany } from "@/lib/translate";
import { notFound } from "next/navigation";
import { queryShop } from "@/lib/listing";
import { canonical } from "@/lib/seo";
import { getCollections } from "@/lib/site-store";
import { ShopView } from "../../shop/ShopView";
import { parseQuery, videosFor, type SP } from "@/lib/shop-query";

const keyOf = (parts: string[]) => parts.map(decodeURIComponent).join("/");

export async function generateMetadata({ params }: { params: Promise<{ key: string[] }> }) {
  const key = keyOf((await params).key);
  const c = (await getCollections()).items.find((x) => x.key.toLowerCase() === key.toLowerCase());
  const title = c?.title ?? key.split("/").pop()!.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  return {
    title: `${title} in Lebanon`,
    description: (c?.description || `Shop ${title} at SuperYou: authentic products from a licensed Lebanese pharmacy, pharmacist advice on WhatsApp and delivery across Lebanon.`).slice(0, 160),
    ...(await canonical(`/collections/${key}/`)),
  };
}

// Collection pages keep the same URLs as the menus (/collections/<handle>/).
export default async function CollectionPage({ params, searchParams }: { params: Promise<{ key: string[] }>; searchParams: Promise<SP> }) {
  const key = keyOf((await params).key);
  const query = { ...parseQuery(await searchParams), collection: key };
  const [result, cols, videos] = await Promise.all([queryShop(query), getCollections(), videosFor(query)]);
  const c = cols.items.find((x) => x.key.toLowerCase() === key.toLowerCase());
  // Nothing on sale (e.g. its source or brands are switched off): the page is gone until they're back.
  const filtered = Object.entries(query).some(([k, v]) => !["collection", "page", "sort"].includes(k) && v !== undefined && v !== false && !(Array.isArray(v) && !v.length));
  if (c?.hidden || (result.total === 0 && !filtered)) notFound();
  const title = c?.title ?? key.split("/").pop()!.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const lang = await getLang();
  const loc = await translateMany([title, c?.description ?? ""], lang);
  const facets = await translateDeep(result.facets, lang, ["name"]);
  return <ShopView result={{ ...result, facets }} query={query} videos={videos} base={`/collections/${key}/`} heading={loc.get(title) ?? title} intro={c?.description ? loc.get(c.description) ?? c.description : undefined} banner={shopImg(c?.image) || undefined} />;
}
