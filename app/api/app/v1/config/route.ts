import { NextResponse } from "next/server";
import { checkoutMethods } from "@/lib/payments";
import { getLayout, getServices, getSettings } from "@/lib/site-store";
import { getTheme } from "@/lib/theme-store";
import { buildPalette } from "@/lib/theme";
import { getGrowth } from "@/lib/growth-store";
import { getExtras } from "@/lib/extras";

// Native app: store settings it needs (delivery zones and fees, payment methods, contacts).
export async function GET() {
  const [s, methods, svc, g, x, theme, layout] = await Promise.all([getSettings(), checkoutMethods(), getServices(), getGrowth(), getExtras(), getTheme(), getLayout()]);
  const pal = buildPalette(theme) as Record<string, string>;
  return NextResponse.json({
    store: { name: s.store.name, tagline: s.store.tagline, whatsapp: s.store.whatsapp, phone: s.store.phone, email: s.store.email },
    delivery: { fee: s.delivery.fee, freeThreshold: s.delivery.freeThreshold, estimate: s.delivery.estimate, zones: s.delivery.zones },
    payments: methods,
    minOrder: s.checkout.minOrder,
    // The website's look, so the app matches it: colours from Admin › Theme, shape and fonts from Admin › Layout.
    theme: { primary: theme.primary, ink: theme.ink, sale: theme.sale, background: theme.background, tint: pal["brand-50"] ?? "", preset: layout.preset, headingFont: layout.headingFont, buttons: layout.buttons, cards: layout.cards, radius: layout.radius },
    features: {
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
