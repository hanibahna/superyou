import { NextResponse } from "next/server";
import { checkoutMethods } from "@/lib/payments";
import { getLayout, getServices, getSettings } from "@/lib/site-store";
import { getTheme } from "@/lib/theme-store";
import { buildPalette } from "@/lib/theme";
import { getGrowth } from "@/lib/growth-store";
import { getExtras } from "@/lib/extras";
import { getTaxonomy } from "@/lib/catalog";
import { liveNav, shopNav } from "@/lib/live-nav";
import type { MenuItem } from "@/lib/site";

// The website's header menu for the app's ☰ menu: label, link and up to two levels below.
const slim = (m: MenuItem[], depth = 0): { label: string; href: string; children: unknown[] }[] =>
  m.map((x) => ({ label: x.label, href: x.href, children: depth < 2 ? slim(x.children ?? [], depth + 1) : [] }));

// Native app: store settings it needs (delivery zones and fees, payment methods, contacts).
export async function GET() {
  const [s, methods, svc, g, x, theme, layout] = await Promise.all([getSettings(), checkoutMethods(), getServices(), getGrowth(), getExtras(), getTheme(), getLayout()]);
  const [nav, tax] = await Promise.all([liveNav(), getTaxonomy()]);
  const menu0 = slim(shopNav(s, nav, tax, g.bulk.wholesale).menu);
  // Brand/range pages (/pages/vichy/) open as the app's own product list instead of a web page.
  const { pageProducts } = await import("@/lib/info-pages");
  const cache = new Map<string, string>();
  const native = async (href: string) => {
    const m = /^\/pages\/([^/]+)\/?$/.exec(href);
    if (!m || ["about", "delivery", "payment", "rewards", "privacy", "contact"].includes(m[1])) return href;
    if (!cache.has(m[1])) {
      const pr = await pageProducts(m[1], s.pages[m[1]]?.title ?? "").catch(() => null);
      const q = new URLSearchParams();
      if (pr?.brand) q.set("brand", pr.brand);
      if (pr?.query) q.set("q", pr.query);
      cache.set(m[1], q.size ? `/shop/?${q}` : href);
    }
    return cache.get(m[1])!;
  };
  type M = { label: string; href: string; children: M[] };
  const fix = async (l: M[]): Promise<M[]> => Promise.all(l.map(async (x) => ({ ...x, href: await native(x.href), children: await fix(x.children) })));
  const menu = await fix(menu0 as M[]);
  const pal = buildPalette(theme) as Record<string, string>;
  return NextResponse.json({
    store: { name: s.store.name, tagline: s.store.tagline, whatsapp: s.store.whatsapp, phone: s.store.phone, email: s.store.email },
    social: s.social,
    menu,
    // Shown under "Delivery & returns" on product pages, as on the website.
    deliveryPolicy: s.pages.delivery?.body ?? "",
    delivery: { fee: s.delivery.fee, freeThreshold: s.delivery.freeThreshold, estimate: s.delivery.estimate, zones: s.delivery.zones },
    payments: methods,
    minOrder: s.checkout.minOrder,
    // The website's look, so the app matches it: colours from Admin › Theme, shape and fonts from Admin › Layout.
    theme: { primary: theme.primary, ink: theme.ink, sale: theme.sale, background: theme.background, tint: pal["brand-50"] ?? "", preset: layout.preset, headingFont: layout.headingFont, buttons: layout.buttons, cards: layout.cards, radius: layout.radius },
    features: {
      // Imported (US) products on sale right now: the app shows its Lebanon / Imported switch only then.
      imported: nav.originCats.has("international"),
      superScan: g.skinScan.enabled,
      advisor: x.advisor.enabled ? { name: x.advisor.name, greeting: x.advisor.greeting, suggestions: x.advisor.suggestions } : null,
      wheel: g.popup.enabled && g.popup.mode === "wheel" ? { title: g.popup.title, text: g.popup.text, slices: g.popup.wheel.map((w) => w.label) } : null,
      game: g.game.enabled ? { celebrate: g.game.celebrate, checkin: g.game.checkin.enabled ? { days: g.game.checkin.days, points: g.game.checkin.points } : null } : null,
      club: g.club.enabled ? { name: g.club.name, pointsPerDollar: g.club.pointsPerDollar, rewardPoints: g.club.rewardPoints, rewardValue: g.club.rewardValue } : null,
      // SuperPrice: we beat other Lebanese shops' prices; the app shows the comparison on each product.
      superPrice: g.priceMatch.enabled && g.priceMatch.badge ? { beatPct: g.priceMatch.beatPct, shops: (await (await import("@/lib/price-match")).shopsRead().catch(() => null))?.filter((x) => x !== "NeoVitale") ?? g.priceMatch.sites.filter((x) => x.enabled && x.showName && x.domain !== "neovitale.com").map((x) => x.label) } : null,
      // SuperPrime: monthly membership with free delivery; joined (or trial started) at checkout.
      prime: g.prime.enabled ? { name: g.prime.name, monthlyPrice: g.prime.monthlyPrice, trialMonths: g.prime.trialMonths, trialMinOrder: g.prime.trialMinOrder, freeMin: g.prime.freeMin, unlimitedSuperPrice: g.prime.unlimitedSuperPrice, promoLive: (await import("@/lib/growth")).primePromoLive(g.prime) } : null,
      // Bulk buy: 2+ of a product paid now get this % (same as Subscribe & save every 3 months by default).
      bulk: g.bulk.enabled && (await import("@/lib/growth")).bulkPct(g) > 0 ? { pct: (await import("@/lib/growth")).bulkPct(g), maxUnits: g.bulk.maxUnits } : null,
      wholesale: g.bulk.wholesale,
      // App offer: shown once on first launch; the discount itself is applied by the server on app orders.
      appOffer: g.apps.firstPct > 0 || g.apps.doublePoints ? { firstPct: g.apps.firstPct, doublePoints: g.apps.doublePoints } : null,
      videoCalls: svc.videoCalls !== false,
      eventsOn: svc.eventsOn !== false,
      subscribe: g.subscribe.enabled ? { monthly: g.subscribe.monthly, quarterly: g.subscribe.quarterly, note: g.subscribe.note, unlockMonthly: g.subscribe.unlockMonthly, unlockQuarterly: g.subscribe.unlockQuarterly } : null,
    },
    // Info pages (About, Delivery, Privacy…) the app lists under Account.
    // Only our own core pages (imported brand landing pages and other shops' policies stay out).
    pages: ["about", "delivery", "payment", "rewards", "privacy", "contact"].flatMap((slug) => (s.pages[slug] ? [{ slug, title: s.pages[slug].title }] : [])),
    services: svc.enabled ? svc.services.filter((v) => v.enabled).map((v) => ({ id: v.id, title: v.title, category: v.category, description: v.description, duration: v.duration, price: v.price, priceNote: v.priceNote, video: v.video ?? "no" })) : [],
  }, { headers: { "Cache-Control": "public, s-maxage=300" } });
}
