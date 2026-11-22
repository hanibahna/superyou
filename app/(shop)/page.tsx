import { BrandStrip, Banners, CategoryTiles, Countdown, HeroSlider, NewsletterSection, ShopByConcern, TextBlock, TikTokProfile, VideoSection } from "@/components/Home";
import { shopImgDeep } from "@/lib/img-server";
import { autoCategories, liveHrefsDeep, liveNav, pruneLinks } from "@/lib/live-nav";
import { CampaignHero, Circles, OffersGrid, PromoTiles } from "@/components/Campaign";
import { ProductCarousel } from "@/components/ProductCarousel";
import { PharmacistBand, PromiseStrip, QuickJump } from "@/components/HomeExtras";
import { publicGrowth } from "@/lib/growth";
import { getGrowth } from "@/lib/growth-store";
import { ProductCard } from "@/components/ProductCard";
import { VideoStrip, VideoWall } from "@/components/Video";
import { getTaxonomy } from "@/lib/catalog";
import { cardsFor, liveCards } from "@/lib/listing";
import { canonical, siteUrl } from "@/lib/seo";
import { listReviews } from "@/lib/growth-store";
import { ReviewsStrip } from "@/components/ReviewsStrip";
import { getLang, getT } from "@/lib/i18n-server";
import { translateDeep } from "@/lib/translate";
import { getLanding, getSettings, getVideoLibrary } from "@/lib/site-store";
import { memo } from "@/lib/memo";

export async function generateMetadata() {
  return { ...(await canonical("/")) };
}

export default async function HomePage() {
  const [cards, tax, landing, lib] = await Promise.all([liveCards(), getTaxonomy().then(async (t) => shopImgDeep(await translateDeep(t, await getLang(), ["name"]))), getLanding(), getVideoLibrary()]);
  if (!cards.length)
    return (
      <div className="container-x py-24 text-center">
        <h1 className="text-3xl font-semibold">The shop is being stocked</h1>
        <p className="mt-2 text-muted">Add products from the admin area (/admin) to see them here.</p>
      </div>
    );

  const counts: Record<string, number> = {};
  const catCount: Record<string, number> = {};
  const catImage: Record<string, string> = {};
  const brandCount = new Map<string, number>();
  for (const c of cards) {
    for (const k of c.concerns) counts[k] = (counts[k] ?? 0) + 1;
    catCount[c.category] = (catCount[c.category] ?? 0) + 1;
    if (!catImage[c.category] && c.image && c.inStock) catImage[c.category] = c.image;
    brandCount.set(c.brand, (brandCount.get(c.brand) ?? 0) + 1);
  }
  const topBrands = [...brandCount.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);

  const lang = await getLang();
  // Tiles and circles that would lead to an empty category (source or brand switched off) are left out.
  const nav = await liveNav();
  const auto = autoCategories(await getTaxonomy(), nav);
  const onSale = landing.sections.filter((s) => s.enabled).map((s) => ("items" in s && Array.isArray(s.items) && (s.type === "tiles" || s.type === "circles" || s.type === "offers") ? { ...s, items: pruneLinks(s.items, nav, auto) } : s)).filter((s) => !((s.type === "tiles" || s.type === "circles" || s.type === "offers") && !s.items.length)).map((s) => shopImgDeep(liveHrefsDeep(s, nav)));
  const sections = await translateDeep(onSale, lang, ["eyebrow", "title", "text", "cta", "cta2", "badge", "body"]);
  // Product rows, campaign products and reviews are the same for every visitor: worked out at most once a minute.
  const minute = Math.floor(Date.now() / 60_000);
  const rows = await memo(`home:rows:${lang}:${minute}`, 70_000, () => Promise.all(sections.map((s) => (s.type === "products" ? cardsFor(s.source, s.limit, s.sort) : Promise.resolve(null)))));

  const settings = await getSettings();
  // Latest approved reviews for the "Loved by our customers" section.
  const homeReviews = sections.some((x) => x.type === "reviews")
    ? (await memo(`home:reviews:${minute}`, 70_000, () => listReviews(300))).filter((r) => r.status === "approved" && r.body.length > 20).map((r) => ({ id: r.id, slug: r.slug, product: r.product, rating: r.rating, title: r.title, body: r.body, name: r.name, verified: r.verified, image: cards.find((c) => c.slug === r.slug)?.image }))
    : [];
  // Products for the auto-scrolling campaign banner(s).
  const heroProducts = new Map<string, Awaited<ReturnType<typeof cardsFor>>>();
  for (const s of landing.sections) if (s.type === "bfhero" && s.enabled && s.slider?.enabled) heroProducts.set(s.id, (await memo(`home:hero:${s.id}:${minute}`, 70_000, () => cardsFor(s.slider!.source, s.slider!.limit * 2, "featured"))).filter((c) => c.image && c.inStock).slice(0, s.slider.limit));
  const base = siteUrl();
  const org = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "OnlineStore", "@id": `${base}/#store`, name: settings.store.name, url: `${base}/`, logo: `${base}/brand/superyou-logo.svg`, telephone: settings.store.phone, address: { "@type": "PostalAddress", addressLocality: settings.store.address, addressCountry: "LB" },
        sameAs: Object.values(settings.social ?? {}).filter((v): v is string => typeof v === "string" && v.startsWith("http")),
        hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "LB", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: 7 } },
      { "@type": "WebSite", url: `${base}/`, name: settings.store.name, potentialAction: { "@type": "SearchAction", target: `${base}/shop/?q={search_term_string}`, "query-input": "required name=search_term_string" } },
    ],
  };
  const t = await getT();
  const scanOn = publicGrowth(await getGrowth(), !!(await (await import("@/lib/extras")).anthropicKey())).skinScan.enabled;
  const firstHero = sections.findIndex((x) => x.type === "bfhero" || x.type === "hero");
  const productIdx = new Map<number, number>();
  sections.forEach((x, i) => x.type === "products" && productIdx.set(i, productIdx.size));
  // The pharmacist band goes after the second product row (or halfway down if there are few).
  const bandAfter = [...productIdx.keys()][1] ?? Math.floor(sections.length / 2);
  // Two rows with the same heading ("Just dropped" twice) get their eyebrow added so each reads as its own.
  const seenTitles = new Set<string>();
  for (const x of sections) if ("title" in x && typeof x.title === "string") {
    const k = x.title.trim().toLowerCase();
    if (k && seenTitles.has(k) && "eyebrow" in x && x.eyebrow) (x as { title: string }).title = `${x.title}: ${x.eyebrow.charAt(0).toUpperCase()}${x.eyebrow.slice(1).toLowerCase()}`;
    seenTitles.add(k);
  }
  const jumpCats = ["skincare", "makeup", "fragrance", "hair", "suncare", "body", "supplements", "baby", "men"];
  const jumps = [
    { label: t("Offers"), href: "/shop/?sale=1", hot: true },
    ...jumpCats.map((slug) => tax.categories.find((c) => c.slug === slug)).filter((c) => c && (catCount[c.slug] ?? 0) > 0).map((c) => ({ label: c!.name, href: `/shop/?category=${c!.slug}` })),
    { label: t("Brands A–Z"), href: "/brands/" },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org).replace(/</g, "\\u003c") }} />
      {sections.map((s, n) => {
        const el = renderSection(s, n);
        const wrapped = el && s.hideOnMobile ? <div key={s.id} className="hidden md:block">{el}</div> : el;
        if (!wrapped) return null;
        const extra = [];
        // Right under the first big banner: the promise, then one-tap jumps to the main aisles.
        if (n === firstHero) extra.push(<PromiseStrip key="promise" t={t} freeOver={settings.delivery.freeThreshold} />, <QuickJump key="jump" t={t} links={jumps} />);
        // Halfway down, an invitation to ask a pharmacist.
        if (n === bandAfter) extra.push(<PharmacistBand key="band" t={t} whatsapp={settings.store.whatsapp} scan={scanOn} />);
        // Product rows alternate on a soft band so the page reads as distinct chapters.
        const banded = s.type === "products" && (productIdx.get(n) ?? 0) % 2 === 1 ? <div key={s.id} className="bg-[#faf7f8]">{wrapped}</div> : wrapped;
        return extra.length ? [banded, ...extra] : banded;
      })}
      {firstHero < 0 && <><PromiseStrip t={t} freeOver={settings.delivery.freeThreshold} /><QuickJump t={t} links={jumps} /></>}
    </>
  );

  function renderSection(s: (typeof sections)[number], n: number) {
        switch (s.type) {
          case "bfhero":
            return <CampaignHero key={s.id} {...s} products={s.slider?.enabled ? heroProducts.get(s.id) : undefined} />;
          case "tiles":
            return <PromoTiles key={s.id} eyebrow={s.eyebrow} title={s.title} items={s.items} />;
          case "circles":
            return <Circles key={s.id} title={s.title} items={s.items} />;
          case "offers":
            return <OffersGrid key={s.id} eyebrow={s.eyebrow} title={s.title} items={s.items} />;
          case "hero":
            return <HeroSlider key={s.id} slides={s.slides} interval={s.interval} height={s.height} />;
          case "countdown":
            return <Countdown key={s.id} eyebrow={s.eyebrow} title={s.title} endsAt={s.endsAt} href={s.href} />;
          case "products": {
            const items = rows[n] ?? [];
            if (!items.length) return null;
            const href = s.source.kind === "tag" ? `/shop/?tag=${s.source.value}` : s.source.kind === "category" ? `/shop/?category=${s.source.value.split(",")[0]}` : s.source.kind === "brand" ? `/shop/?brand=${encodeURIComponent(s.source.value.split(",")[0])}` : s.source.kind === "search" ? `/shop/?q=${encodeURIComponent(s.source.value)}` : s.source.kind === "sale" ? "/shop/?sale=1" : s.source.kind === "collection" ? `/collections/${s.source.value}/` : undefined;
            if (s.layout === "grid")
              return (
                <section key={s.id} className="hsec container-x py-8">
                  {s.eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{s.eyebrow}</p>}
                  <h2 className="mb-5 mt-1 text-2xl font-semibold md:text-3xl">{s.title}</h2>
                  <div className="pgrid grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{items.map((p) => <ProductCard key={p.slug} product={p} />)}</div>
                </section>
              );
            return <ProductCarousel key={s.id} eyebrow={s.eyebrow} title={s.title} products={items} href={href} />;
          }
          case "categories": {
            const list = (s.slugs.length ? s.slugs.map((slug) => tax.categories.find((c) => c.slug === slug)).filter((c) => !!c) : tax.categories.filter((c) => c.menu !== false))
              .map((c) => ({ slug: c!.slug, name: c!.name, image: c!.image || catImage[c!.slug], count: catCount[c!.slug] ?? 0 }))
              .filter((c) => c.count > 0);
            return <CategoryTiles key={s.id} eyebrow={s.eyebrow} title={s.title} tiles={list} />;
          }
          case "concerns":
            return <ShopByConcern key={s.id} concerns={tax.concerns.filter((c) => counts[c.slug])} counts={counts} eyebrow={s.eyebrow} title={s.title} />;
          case "brands":
            return <BrandStrip key={s.id} title={s.title} brands={(s.brands.length ? s.brands : topBrands).slice(0, s.limit)} logos={Object.fromEntries((s.logos ?? []).filter((l) => l.image).map((l) => [l.brand.toLowerCase(), l.image]))} />;
          case "reviews": {
            const list = homeReviews.filter((r) => r.rating >= s.minRating).slice(0, s.limit);
            if (list.length < 3) return null;
            return <ReviewsStrip key={s.id} eyebrow={s.eyebrow} title={s.title} reviews={list} />;
          }
          case "banners":
            return <Banners key={s.id} title={s.title} columns={s.columns} items={s.items} />;
          case "video":
            return <VideoSection key={s.id} {...s} />;
          case "text":
            return <TextBlock key={s.id} {...s} />;
          case "newsletter":
            return <NewsletterSection key={s.id} title={s.title} text={s.text} />;
          case "social": {
            if (s.source === "tiktok-profile") return <TikTokProfile key={s.id} handle={s.handle} eyebrow={s.eyebrow} title={s.title} />;
            const vids = lib.items.filter((v) => v.enabled && (!s.filter.categories.length || v.categories.some((c) => s.filter.categories.includes(c))) && (!s.filter.brands.length || v.brands.some((b) => s.filter.brands.includes(b)))).slice(0, s.limit);
            if (!vids.length) return null;
            const shop = s.display === "shoppable" ? Object.fromEntries(cards.filter((c) => vids.some((v) => v.products.includes(c.slug))).map((c) => [c.slug, c])) : undefined;
            return <div key={s.id} className="container-x">{s.display === "cards" ? <VideoStrip videos={vids} title={s.title} eyebrow={s.eyebrow} /> : <VideoWall videos={vids} title={s.title} eyebrow={s.eyebrow} shop={shop} />}</div>;
          }
        }
  }
}
