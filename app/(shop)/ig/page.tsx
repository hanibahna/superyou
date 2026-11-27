import type { Metadata } from "next";
import Link from "next/link";
import { getGrowth } from "@/lib/growth-store";
import { getOps } from "@/lib/ops-store";
import { getSettings } from "@/lib/site-store";
import { getTaxonomy } from "@/lib/catalog";
import { liveNav, shopNav } from "@/lib/live-nav";
import { cardsFor } from "@/lib/listing";
import { ProductCard } from "@/components/ProductCard";

// Link-in-bio page for Instagram (and TikTok): a small shop (shop the feed, best sellers, new in)
// plus every feature and section, one tap each. Instagram Shops isn't offered in Lebanon, so this is it.
// Only what is switched on in Admin shows. Each link carries the Instagram tracking tag.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "SuperYou links", description: "Shop SuperYou: original beauty and parapharmacy, delivered across Lebanon, pay on delivery.", robots: { index: false } };

const tag = (href: string) => (href.startsWith("http") ? href : `${href}${href.includes("?") ? "&" : "?"}utm_source=instagram&utm_medium=bio`);

export default async function InstagramLinks() {
  const [g, ops, s, nav, tax] = await Promise.all([getGrowth(), getOps(), getSettings(), liveNav(), getTaxonomy()]);
  const wa = s.store.whatsapp ? `https://wa.me/${s.store.whatsapp}?text=${encodeURIComponent("Hello SuperYou, I found you on Instagram")}` : "";
  const features: { title: string; text: string; href: string; on: boolean }[] = [
    { title: "Shop all products", text: "100% original, delivered in 1–3 days, pay when it arrives", href: "/shop/", on: true },
    { title: "Today's deals", text: "Everything on offer right now", href: "/shop/?sale=1", on: true },
    { title: "SuperScan: free 3D skin scan", text: "Your skin type and a routine in a minute; photos never stored", href: "/skin-scan/", on: g.skinScan.enabled },
    { title: "Build my routine", text: "Answer a few questions, get your steps and products", href: "/routine/", on: true },
    { title: "Find my shade", text: "Foundation and concealer matched to you", href: "/shade-finder/", on: true },
    { title: g.club.name || "SuperYou Club", text: "Points on every order, rewards on WhatsApp", href: "/club/", on: g.club.enabled },
    { title: "Gift cards", text: "Send by WhatsApp or email", href: "/gift-cards/", on: ops.giftCards.enabled },
    { title: g.advent.title || "Advent calendar", text: "A new surprise behind every door", href: "/advent/", on: g.advent.enabled },
    { title: "All brands A–Z", text: "La Roche-Posay, Vichy, Avène, Kérastase and more", href: "/brands/", on: true },
  ];
  const [best, fresh] = await Promise.all([cardsFor({ kind: "tag", value: "favorite" }, 24), cardsFor({ kind: "tag", value: "new" }, 24, "new")]);
  const inStock = (l: typeof best) => l.filter((p) => p.inStock && p.price > 0);
  const bestSellers = inStock(best).slice(0, 8);
  const newIn = inStock(fresh).filter((p) => !bestSellers.some((b) => b.slug === p.slug)).slice(0, 8);
  // Each Instagram post, with where it leads.
  const feed: [number, string, string][] = [
    [9, "/skin-scan/", "SuperScan 3D skin scan"],
    [7, "/shop/?category=suncare", "Sunscreens"],
    [6, "/shop/", "Delivered to your door"],
    [5, "/shop/?category=suncare", "Subscribe and save on sunscreen"],
    [4, "/shop/?brand=SkinCeuticals", "SkinCeuticals"],
    [3, "/shop/?concern=acne", "Breakout routine"],
    [1, "/shop/", "Shop SuperYou"],
    [8, "/shop/", "Shop all"],
  ];
  const sections = shopNav(s, nav, tax, false).menu.filter((m) => m.href && m.href !== "#" && !m.href.startsWith("/brands")).slice(0, 8);
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600">@superyoulb</p>
        <h1 className="mt-2 text-3xl font-black">SuperYou</h1>
        <p className="mt-2 text-sm text-muted">Original beauty and parapharmacy · delivered across Lebanon · pay on delivery</p>
      </div>
      {wa && (
        <a href={wa} className="tap mt-6 flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-4 font-bold text-white">
          Order or ask our pharmacist on WhatsApp
        </a>
      )}
      <p className="mt-8 text-xs font-bold uppercase tracking-[0.3em] text-muted">Shop the feed</p>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {feed.map(([n, href, label]) => (
          <Link key={n} href={tag(href)} aria-label={label} className="block overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/ig/post-${n}.jpg`} alt={label} width={540} height={675} className="aspect-[4/5] w-full object-cover" loading="lazy" />
          </Link>
        ))}
      </div>
      {bestSellers.length > 0 && (
        <>
          <div className="mt-8 flex items-baseline justify-between"><p className="text-xs font-bold uppercase tracking-[0.3em] text-muted">Best sellers</p><Link href={tag("/shop/?tag=favorite")} className="text-sm font-semibold underline">See all</Link></div>
          <div className="pgrid mt-3 grid grid-cols-2 gap-3">{bestSellers.map((p) => <ProductCard key={p.slug} product={p} />)}</div>
        </>
      )}
      {newIn.length > 0 && (
        <>
          <div className="mt-8 flex items-baseline justify-between"><p className="text-xs font-bold uppercase tracking-[0.3em] text-muted">New in</p><Link href={tag("/shop/?tag=new")} className="text-sm font-semibold underline">See all</Link></div>
          <div className="pgrid mt-3 grid grid-cols-2 gap-3">{newIn.map((p) => <ProductCard key={p.slug} product={p} />)}</div>
        </>
      )}
      <p className="mt-8 text-xs font-bold uppercase tracking-[0.3em] text-muted">More from SuperYou</p>
      <ul className="mt-3 space-y-3">
        {features.filter((f) => f.on).map((f) => (
          <li key={f.title}>
            <Link href={tag(f.href)} className="tap block rounded-2xl border border-line bg-white px-5 py-4 hover:border-ink">
              <span className="block font-bold">{f.title}</span>
              <span className="mt-0.5 block text-sm text-muted">{f.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      {sections.length > 0 && (
        <>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.3em] text-muted">Shop by section</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sections.map((m) => (
              <Link key={m.label} href={tag(m.href)} className="tap rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-ink">{m.label}</Link>
            ))}
          </div>
        </>
      )}
      {(g.apps.ios || g.apps.android) && (
        <div className="mt-8 grid grid-cols-2 gap-3">
          {g.apps.ios && <a href={g.apps.ios} className="tap rounded-2xl bg-ink px-4 py-3 text-center text-sm font-bold text-white">App Store</a>}
          {g.apps.android && <a href={g.apps.android} className="tap rounded-2xl bg-ink px-4 py-3 text-center text-sm font-bold text-white">Google Play</a>}
        </div>
      )}
    </div>
  );
}
