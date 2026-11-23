import { NextResponse } from "next/server";
import { cardsByTag, cardsFor, liveCards, queryShop } from "@/lib/listing";
import { getLanding, getSettings } from "@/lib/site-store";
import { getTaxonomy } from "@/lib/catalog";
import { autoCategories, liveNav, pruneLinks } from "@/lib/live-nav";
import { getGrowth } from "@/lib/growth-store";
import { siteUrl } from "@/lib/site-url";
import type { ProductSource, Tile } from "@/lib/site";

// Native app home: the SAME sections, in the same order, as the website's home page (Admin → Homepage).
// `sections` is the new feed; `banners`, `categories` and `rows` stay for app builds made before it.
const abs = (u?: string) => (!u ? "" : u.startsWith("http") ? u : `${siteUrl()}${u}`);
// iOS can't draw SVG: the app gets the PNG copies of our home artwork.
const png = (u?: string) => abs(u && /^\/brand\/home\/[\w-]+\.svg$/.test(u) ? u.replace("/brand/home/", "/brand/home/png/").replace(/\.svg$/, ".png") : u);
const tile = (t: Tile) => ({ title: t.title, text: t.text, cta: t.cta, href: t.href, image: png(t.image), bg: t.bg, badge: t.badge });
const card = <T extends { image?: string }>(p: T) => ({ ...p, image: abs(p.image) });
const hrefFor = (s: ProductSource) =>
  s.kind === "tag" ? `/shop/?tag=${s.value}` : s.kind === "category" ? `/shop/?category=${s.value.split(",")[0]}` : s.kind === "brand" ? `/shop/?brand=${encodeURIComponent(s.value.split(",")[0])}`
    : s.kind === "search" ? `/shop/?q=${encodeURIComponent(s.value)}` : s.kind === "sale" ? "/shop/?sale=1" : s.kind === "concern" ? `/shop/?concern=${s.value.split(",")[0]}` : s.kind === "collection" ? `/collections/${s.value}/` : "/shop/";

export async function GET() {
  const [landing, cards, tax, nav, settings, growth] = await Promise.all([getLanding(), liveCards(), getTaxonomy(), liveNav(), getSettings(), getGrowth()]);
  const auto = autoCategories(tax, nav);
  const counts: Record<string, number> = {}, catCount: Record<string, number> = {}, catImage: Record<string, string> = {};
  const brandCount = new Map<string, number>();
  for (const c of cards) {
    for (const k of c.concerns) counts[k] = (counts[k] ?? 0) + 1;
    catCount[c.category] = (catCount[c.category] ?? 0) + 1;
    if (!catImage[c.category] && c.image && c.inStock) catImage[c.category] = c.image;
    brandCount.set(c.brand, (brandCount.get(c.brand) ?? 0) + 1);
  }
  const topBrands = [...brandCount.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
  const live = landing.sections.filter((s) => s.enabled && !s.hideOnMobile);

  const sections = (await Promise.all(live.map(async (s) => {
    switch (s.type) {
      case "bfhero": {
        const products = s.slider?.enabled ? (await cardsFor(s.slider.source, s.slider.limit * 2, "featured")).filter((c) => c.image && c.inStock).slice(0, s.slider.limit).map(card) : [];
        return { type: "campaign", id: s.id, eyebrow: s.eyebrow, title: s.title, text: s.text, badge: s.badge, cta: s.cta, href: s.href, cta2: s.cta2, href2: s.href2, endsAt: s.endsAt, cards: products };
      }
      case "hero":
        return { type: "banners", id: s.id, title: "", items: s.slides.map((x) => ({ eyebrow: x.eyebrow, title: x.title, text: x.text, cta: x.cta, href: x.href, image: png(x.image), bg: x.from || "" })) };
      case "banners":
        return { type: "banners", id: s.id, title: s.title, items: s.items.map((x) => ({ eyebrow: "", title: x.title, text: x.text, cta: "", href: x.href, image: png(x.image), bg: "" })) };
      case "circles":
        return { type: "circles", id: s.id, title: s.title, items: pruneLinks(s.items, nav, auto).map(tile) };
      case "tiles":
      case "offers":
        return { type: s.type, id: s.id, eyebrow: s.eyebrow, title: s.title, items: pruneLinks(s.items, nav, auto).map(tile) };
      case "categories": {
        const list = (s.slugs.length ? s.slugs.map((slug) => tax.categories.find((c) => c.slug === slug)).filter((c) => !!c) : tax.categories.filter((c) => c.menu !== false))
          .filter((c) => (catCount[c!.slug] ?? 0) > 0)
          .map((c) => ({ title: c!.name, text: "", cta: "", href: `/shop/?category=${c!.slug}`, image: abs(c!.image || catImage[c!.slug]), bg: "", badge: "" }));
        return { type: "circles", id: s.id, title: s.title, items: list };
      }
      case "concerns":
        return { type: "chips", id: s.id, eyebrow: s.eyebrow, title: s.title, items: tax.concerns.filter((c) => counts[c.slug]).map((c) => ({ title: c.name, href: `/shop/?concern=${c.slug}` })) };
      case "brands":
        return { type: "chips", id: s.id, eyebrow: "", title: s.title, items: (s.brands.length ? s.brands : topBrands).slice(0, s.limit).map((b) => ({ title: b, href: `/shop/?brand=${encodeURIComponent(b)}` })) };
      case "products": {
        const items = (await cardsFor(s.source, s.limit, s.sort)).map(card);
        if (!items.length) return null;
        return { type: "products", id: s.id, eyebrow: s.eyebrow, title: s.title, href: hrefFor(s.source), cards: items };
      }
      case "countdown":
        return s.endsAt && Date.parse(s.endsAt) > Date.now() ? { type: "countdown", id: s.id, eyebrow: s.eyebrow, title: s.title, endsAt: s.endsAt, href: s.href } : null;
      case "text":
        return { type: "text", id: s.id, eyebrow: s.eyebrow, title: s.title, text: s.body, cta: s.cta, href: s.href };
      case "newsletter":
        return { type: "newsletter", id: s.id, title: s.title, text: s.text };
      case "video":
        return s.url ? { type: "text", id: s.id, eyebrow: s.eyebrow, title: s.title, text: s.text, cta: s.cta || "Watch", href: s.href || s.url } : null;
      default:
        return null; // reviews and social videos stay on the website for now
    }
  }))).filter(Boolean) as { type: string; id: string; title?: string }[];

  // Same extras the website adds: the promise and the SuperScan invitation under the first big banner,
  // and the pharmacist band after the second product row.
  const firstHero = sections.findIndex((x) => x.type === "campaign" || x.type === "banners");
  const free = settings.delivery.freeThreshold;
  const extras = [{ type: "promise", id: "promise", title: "Every product original", text: `Every question answered. Every order at your door, paid when it arrives.${free > 0 ? ` Free delivery over $${free}.` : ""}` }];
  if (growth.skinScan?.enabled) extras.push({ type: "scan", id: "scan", title: "Not sure what your skin needs?", text: "Take a free 3D skin scan with SuperScan and get a routine in a minute." });
  sections.splice(firstHero + 1, 0, ...extras);
  const productAt = sections.map((x, i) => (x.type === "products" ? i : -1)).filter((i) => i >= 0);
  const bandAt = productAt[1] ?? Math.floor(sections.length / 2);
  sections.splice(bandAt + 1, 0, { type: "pharmacist", id: "pharmacist", title: "Ask a pharmacist, free", text: "Real advice on WhatsApp or a video call, before and after you buy." } as never);

  // Older app builds: banners, categories and three rows.
  const hero = landing.sections.find((s) => s.type === "hero" && s.enabled) as { slides: { eyebrow: string; title: string; text: string; cta: string; href: string; image: string }[] } | undefined;
  const circles = landing.sections.find((s) => s.type === "circles" && s.enabled) as { items: { title: string; href: string; image: string; bg: string }[] } | undefined;
  const [best, sale] = await Promise.all([
    cardsByTag("bestseller" as never, 16).catch(() => []),
    queryShop({ sale: true, sort: "discount", perPage: 16 }).then((r) => r.items).catch(() => []),
  ]);
  return NextResponse.json({
    sections,
    banners: (hero?.slides ?? []).map((s) => ({ eyebrow: s.eyebrow, title: s.title, text: s.text, cta: s.cta, href: s.href, image: png(s.image) })),
    categories: (circles?.items ?? []).map((t) => ({ title: t.title, href: t.href, image: png(t.image), bg: t.bg })),
    rows: [
      { title: "On sale", query: "sale=1", items: sale },
      { title: "Best sellers", query: "tag=bestseller", items: best },
    ].filter((r) => r.items.length).map((r) => ({ ...r, items: r.items.map(card) })),
  }, { headers: { "Cache-Control": "public, s-maxage=120" } });
}
