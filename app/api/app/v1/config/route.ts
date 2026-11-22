import { NextResponse } from "next/server";
import { checkoutMethods } from "@/lib/payments";
import { getSettings } from "@/lib/site-store";

// Native app: store settings it needs (delivery zones and fees, payment methods, contacts).
export async function GET() {
  const [s, methods] = await Promise.all([getSettings(), checkoutMethods()]);
  return NextResponse.json({
    store: { name: s.store.name, tagline: s.store.tagline, whatsapp: s.store.whatsapp, phone: s.store.phone, email: s.store.email },
    delivery: { fee: s.delivery.fee, freeThreshold: s.delivery.freeThreshold, estimate: s.delivery.estimate, zones: s.delivery.zones },
    payments: methods,
    minOrder: s.checkout.minOrder,
  }, { headers: { "Cache-Control": "public, s-maxage=300" } });
}
