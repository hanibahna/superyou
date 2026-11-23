import { NextResponse } from "next/server";
import { checkoutMethods } from "@/lib/payments";
import { getServices, getSettings } from "@/lib/site-store";
import { getGrowth } from "@/lib/growth-store";
import { getExtras } from "@/lib/extras";

// Native app: store settings it needs (delivery zones and fees, payment methods, contacts).
export async function GET() {
  const [s, methods, svc, g, x] = await Promise.all([getSettings(), checkoutMethods(), getServices(), getGrowth(), getExtras()]);
  return NextResponse.json({
    store: { name: s.store.name, tagline: s.store.tagline, whatsapp: s.store.whatsapp, phone: s.store.phone, email: s.store.email },
    delivery: { fee: s.delivery.fee, freeThreshold: s.delivery.freeThreshold, estimate: s.delivery.estimate, zones: s.delivery.zones },
    payments: methods,
    minOrder: s.checkout.minOrder,
    features: {
      superScan: g.skinScan.enabled,
      advisor: x.advisor.enabled ? { name: x.advisor.name, greeting: x.advisor.greeting, suggestions: x.advisor.suggestions } : null,
      subscribe: g.subscribe.enabled ? { monthly: g.subscribe.monthly, quarterly: g.subscribe.quarterly, note: g.subscribe.note } : null,
    },
    services: svc.enabled ? svc.services.filter((v) => v.enabled).map((v) => ({ id: v.id, title: v.title, category: v.category, description: v.description, duration: v.duration, price: v.price, priceNote: v.priceNote, video: v.video ?? "no" })) : [],
  }, { headers: { "Cache-Control": "public, s-maxage=300" } });
}
