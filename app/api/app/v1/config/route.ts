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
      subscribe: g.subscribe.enabled ? { monthly: g.subscribe.monthly, quarterly: g.subscribe.quarterly, note: g.subscribe.note, unlockMonthly: g.subscribe.unlockMonthly, unlockQuarterly: g.subscribe.unlockQuarterly } : null,
    },
    services: svc.enabled ? svc.services.filter((v) => v.enabled).map((v) => ({ id: v.id, title: v.title, category: v.category, description: v.description, duration: v.duration, price: v.price, priceNote: v.priceNote, video: v.video ?? "no" })) : [],
  }, { headers: { "Cache-Control": "public, s-maxage=300" } });
}
