import { getT } from "@/lib/i18n-server";
import { isSubscribable } from "@/lib/subscribable";
import { shopImg } from "@/lib/img-server";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { RecentlyViewed } from "@/components/Growth";
import { ProductCard } from "@/components/ProductCard";
import { Reviews } from "@/components/Reviews";
import { stepOf } from "@/lib/growth";
import { getGrowth, productReviews } from "@/lib/growth-store";
import { toCards } from "@/lib/listing";
import { ProductCarousel } from "@/components/ProductCarousel";
import { VideoPlayer, VideoStrip, isVertical } from "@/components/Video";
import { ImageVideos } from "@/components/ImageVideos";
import { HowToUse } from "@/components/HowToUse";
import { QuickHelp } from "@/components/QuickHelp";
import { TipLine } from "@/components/TipLine";
import { sectionFor } from "@/lib/extras";
import { getGroupBySlug, getProductDetail, getTaxonomy } from "@/lib/catalog";
import { money } from "@/lib/format";
import { liveCards } from "@/lib/listing";
import { liveProducts } from "@/lib/pricing";
import { canonical, siteUrl } from "@/lib/seo";
import { getRoutine, getSettings, getVideoLibrary } from "@/lib/site-store";
import { getLang } from "@/lib/i18n-server";
import { translateMany } from "@/lib/translate";
import { BuyBox } from "./BuyBox";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const [p] = await getGroupBySlug(slug);
  if (!p) return {};
  const d = await getProductDetail(p.id);
  const desc = (d?.description || `${p.brand} ${p.name} at SuperYou Lebanon.`).replace(/\s+/g, " ").slice(0, 155);
  return {
    title: `${p.brand} ${p.name}${p.size ? ` ${p.size}` : ""}`.slice(0, 70),
    description: `${desc}${desc.length >= 155 ? "…" : ""}`,
    ...(await canonical(`/products/${slug}/`)),
    openGraph: { type: "website", title: `${p.brand} ${p.name}`, description: desc, images: d?.images?.slice(0, 1).map((x) => siteUrl() + (shopImg(x) ?? "")) ?? [] },
  };
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ v?: string }> }) {
  const tx = await getT();
  const slug = (await params).slug;
  const [raw, live] = await Promise.all([getGroupBySlug(slug), liveProducts()]);
  // Show live (sale) prices.
  const variants = raw.map((v) => live.byId.get(v.id)).filter((v): v is NonNullable<typeof v> => !!v) // hidden catalogs/brands are excluded
    .map(({ source: _s, cost: _cost, collections: _c, ...v }) => ({ ...v, image: shopImg(v.image) })); // the supplier's name never reaches the browser
  if (!variants.length) {
    const kept = live.dupOf.get(slug); // same product shown under the other catalog's listing
    if (kept) permanentRedirect(`/products/${kept}/`);
    notFound();
  }
  const wanted = (await searchParams).v;
  const initial = variants.find((v) => v.id === wanted) ?? variants.find((v) => v.inStock) ?? variants[0];
  const [detail, { categories, concerns }, cards, settings, lib, growth, reviews, routine] = await Promise.all([getProductDetail(initial.id), getTaxonomy(), liveCards(), getSettings(), getVideoLibrary(), getGrowth(), productReviews(slug), getRoutine()]);
  if (!detail) notFound();
  // Product texts in the visitor's language (translated once by AI, then saved). Ingredients (INCI) stay as they are.
  const lang = await getLang();
  const loc = await translateMany([detail.description, detail.howToUse, ...categories.map((c) => c.name), ...concerns.map((c) => c.name)], lang);
  const L = (s: string) => loc.get(s) ?? s;

  const category = categories.find((c) => c.slug === initial.category);
  // "Pairs well with": other routine steps, same brand first, in stock.
  const myStep = stepOf(initial, routine.steps);
  const pairs: typeof cards = [];
  if (myStep) {
    const seen = new Set<string>([myStep]);
    const pool = [...cards.filter((c) => c.brand === initial.brand), ...cards.filter((c) => c.brand !== initial.brand && c.category === initial.category)];
    for (const c of pool) {
      if (!c.inStock || c.slug === initial.slug) continue;
      const st = stepOf(c, routine.steps);
      if (st && !seen.has(st)) (seen.add(st), pairs.push(c));
      if (pairs.length >= 3) break;
    }
  }
  const related = cards.filter((c) => c.slug !== initial.slug && c.inStock && (c.brand === initial.brand || c.category === initial.category)).slice(0, 12);
  // Description etc. are shared by all sizes/shades of an item.
  const gallery = Array.from(new Set([...detail.images.map((x) => shopImg(x)!), ...variants.map((v) => v.image).filter((x): x is string => !!x)]));
  const subOk = isSubscribable(initial) && (!growth.subscribe.collection || (await (await import("@/lib/listing")).collectionMembers(growth.subscribe.collection)).some((p) => variants.some((v) => v.id === p.id)));
  const sec0 = await sectionFor(initial.category);
  const ptips = (await import("@/lib/tips")).productTips({ name: `${initial.name} ${initial.brand}`, category: initial.category, concerns: [...initial.concerns, ...initial.concerns.map((c) => concerns.find((x) => x.slug === c)?.name ?? "")], text: `${detail.ingredients ?? ""}` });
  const sec = sec0 ? { ...sec0, tips: ptips } : null; // only tips about this exact kind of product
  const how = detail.video;
  const videos = lib.show.product
    ? lib.items.filter((v) => v.enabled && (v.products.includes(initial.slug) || v.brands.some((b) => b.toLowerCase() === initial.brand.toLowerCase()) && v.categories.includes(initial.category))).slice(0, 10)
    : [];

  // Structured data so Google and AI assistants can read price & availability.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: initial.name,
    brand: { "@type": "Brand", name: initial.brand },
    image: gallery.slice(0, 5).map((x) => (x.startsWith("/") ? siteUrl() + x : x)),
    description: detail.description.slice(0, 5000),
    ...(reviews.length ? { aggregateRating: { "@type": "AggregateRating", ratingValue: +(reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1), reviewCount: reviews.length } } : {}),
    offers: variants.map((v) => ({
      "@type": "Offer",
      url: `${siteUrl()}/products/${slug}/?v=${v.id}`,
      seller: { "@type": "Organization", name: settings.store.name },
      shippingDetails: { "@type": "OfferShippingDetails", shippingDestination: { "@type": "DefinedRegion", addressCountry: "LB" }, shippingRate: { "@type": "MonetaryAmount", value: settings.delivery.fee, currency: "USD" }, deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" }, transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" } } },
      hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "LB", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: 7, returnMethod: "https://schema.org/ReturnByMail", returnFees: "https://schema.org/FreeReturn" },
      sku: v.sku,
      name: v.variant ?? v.size,
      price: v.price,
      priceCurrency: "USD",
      availability: v.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl()}/` }, ...(category ? [{ "@type": "ListItem", position: 2, name: category.name, item: `${siteUrl()}/shop/?category=${category.slug}` }] : []), { "@type": "ListItem", position: category ? 3 : 2, name: initial.name }] }).replace(/</g, "\\u003c") }} />
      <div className="container-x py-8">
        <nav className="mb-5 line-clamp-1 text-xs text-muted">
          <Link href="/" className="hover:underline">Home</Link> /{" "}
          {category && <><Link href={`/shop/?category=${category.slug}`} className="hover:underline">{L(category.name)}</Link> / </>}
          <span>{initial.name}</span>
        </nav>
        <QuickHelp className="mb-3" />
        {sec && <TipLine tips={sec.tips} banner={sec.banner} />}

        <BuyBox underImage={<ImageVideos slug={slug} brand={initial.brand} name={initial.name} />} subOk={subOk} variants={variants} initialId={initial.id} gallery={gallery} concernNames={Object.fromEntries(concerns.map((c) => [c.slug, L(c.name)]))} freeOver={settings.delivery.freeThreshold > 0 ? money(settings.delivery.freeThreshold) : ""}>
          <HowToUse slug={slug} name={initial.name} brand={initial.brand} how={L(detail.howToUse) ?? ""} tips={ptips} initialGuide={await (await import("@/lib/product-guide")).getGuide(slug)} />
          <div className="mt-8 divide-y divide-line border-y border-line">
            {detail.description && <Section title={tx("Description")} open>{L(detail.description)}</Section>}
            {(detail.howToUse || how) && (
              <Section title={tx("Directions on the pack")} open={!!how}>
                {how && (
                  <div className={`mb-4 overflow-hidden rounded-xl bg-black ${isVertical(how) ? "mx-auto aspect-[9/16] max-w-xs" : "aspect-video"}`}>
                    <VideoPlayer url={how} title={`How to use ${initial.name}`} />
                  </div>
                )}
                {L(detail.howToUse)}
              </Section>
            )}
            {detail.ingredients && <Section title={tx("Ingredients")}>{detail.ingredients}</Section>}
            <Section title="Delivery & returns">
              {settings.pages.delivery?.body || "See our delivery and returns policy."}
            </Section>
          </div>
        </BuyBox>
      </div>
      {pairs.length > 0 && (
        <section className="container-x py-8">
          <h2 className="text-xl font-semibold">Pairs well with</h2>
          <p className="mb-4 text-sm text-muted">Complete the routine{growth.bundles.enabled ? ` — ${growth.bundles.minSteps} different steps in your bag get ${growth.bundles.percent}% off` : ""}.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{toCards(pairs).map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
      {videos.length > 0 && <div className="container-x"><VideoStrip videos={videos} title={tx("Watch & learn")} eyebrow={tx("Videos")} /></div>}
      {growth.reviews.enabled && <Reviews slug={slug} product={`${initial.brand} ${initial.name}`} reviews={reviews.map(({ id, rating, title, body, name, skinType, photo, verified, createdAt, reply }) => ({ id, rating, title, body, name, skinType, photo, verified, createdAt, reply }))} />}
      <ProductCarousel eyebrow="You may also like" title="Related products" products={related} />
      <RecentlyViewed exclude={slug} />
    </>
  );
}

function Section({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
        {title}
        <span className="text-muted transition group-open:rotate-45">+</span>
      </summary>
      <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{children}</div>
    </details>
  );
}
