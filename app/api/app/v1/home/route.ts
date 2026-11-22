import { NextResponse } from "next/server";
import { cardsByTag, queryShop } from "@/lib/listing";
import { getLanding } from "@/lib/site-store";
import { siteUrl } from "@/lib/site-url";

// Native app home: banners, categories and product rows, from the same Admin → Homepage setup.
const abs = (u?: string) => (!u ? "" : u.startsWith("http") ? u : `${siteUrl()}${u}`);
// iOS can't draw SVG: the app gets the PNG copies of our home artwork.
const png = (u?: string) => abs(u && /^\/brand\/home\/[\w-]+\.svg$/.test(u) ? u.replace("/brand/home/", "/brand/home/png/").replace(/\.svg$/, ".png") : u);

export async function GET() {
  const landing = await getLanding();
  const hero = landing.sections.find((s) => s.type === "hero" && s.enabled) as { slides: { eyebrow: string; title: string; text: string; cta: string; href: string; image: string }[] } | undefined;
  const circles = landing.sections.find((s) => s.type === "circles" && s.enabled) as { items: { title: string; href: string; image: string; bg: string }[] } | undefined;
  const [best, sale, imported] = await Promise.all([
    cardsByTag("bestseller" as never, 16).catch(() => []),
    queryShop({ sale: true, sort: "discount", perPage: 16 }).then((r) => r.items).catch(() => []),
    queryShop({ origin: "international", sort: "featured", perPage: 16 }).then((r) => r.items).catch(() => []),
  ]);
  return NextResponse.json({
    banners: (hero?.slides ?? []).map((s) => ({ eyebrow: s.eyebrow, title: s.title, text: s.text, cta: s.cta, href: s.href, image: png(s.image) })),
    categories: (circles?.items ?? []).map((t) => ({ title: t.title, href: t.href, image: png(t.image), bg: t.bg })),
    rows: [
      { title: "On sale", query: "sale=1", items: sale },
      { title: "Best sellers", query: "tag=bestseller", items: best },
      { title: "Imported from the USA", query: "origin=international", items: imported },
    ].filter((r) => r.items.length).map((r) => ({ ...r, items: r.items.map((p) => ({ ...p, image: abs(p.image) })) })),
  }, { headers: { "Cache-Control": "public, s-maxage=120" } });
}
