// Day-to-day operations settings: stock alerts, couriers, invoices, gift cards, abandoned carts.
// Client-safe (types, defaults, validation).

import { z } from "zod";

export type Courier = { id: string; name: string; trackingUrl: string; phone: string; api?: "" | "aramex" | "dhl" | "track17" };

export type Ops = {
  stock: { lowAt: number; alertEmail: string; restockOnCancel: boolean };
  couriers: Courier[];
  invoice: { title: string; businessName: string; taxId: string; footer: string };
  giftCards: { enabled: boolean; validMonths: number };
  carts: { enabled: boolean; afterHours: number; maxAgeHours: number };
  /** Supplier → courier → customer: labels to the supplier, pickup request to the courier, proof of delivery. */
  fulfil: { enabled: boolean; source: string; supplierName: string; supplierEmail: string; supplierWhatsapp: string; supplierAddress: string; courierName: string; courierEmail: string; courierWhatsapp: string; teamEmail: string; teamWhatsapp: string };
};

export const defaultOps: Ops = {
  stock: { lowAt: 5, alertEmail: "", restockOnCancel: true },
  couriers: [
    { id: "own", name: "Our driver", trackingUrl: "", phone: "" },
    { id: "wakilni", name: "Wakilni", trackingUrl: "https://portal.wakilni.com/orders/{tracking}", phone: "" },
    { id: "aramex", name: "Aramex", trackingUrl: "https://www.aramex.com/lb/en/track/results?ShipmentNumber={tracking}", phone: "", api: "aramex" },
    { id: "dhl", name: "DHL Express", trackingUrl: "https://www.dhl.com/lb-en/home/tracking/tracking-express.html?tracking-id={tracking}", phone: "", api: "dhl" },
    { id: "libanpost", name: "LibanPost", trackingUrl: "https://t.17track.net/en#nums={tracking}", phone: "", api: "track17" },
    { id: "toters", name: "Toters", trackingUrl: "", phone: "" },
  ],
  invoice: { title: "Invoice", businessName: "", taxId: "", footer: "Thank you for shopping with SuperYou. Questions? WhatsApp us on +961 70 777 608." },
  giftCards: { enabled: true, validMonths: 12 },
  carts: { enabled: true, afterHours: 2, maxAgeHours: 48 },
  fulfil: { enabled: false, source: "neovitale.com", supplierName: "NeoVitale", supplierEmail: "", supplierWhatsapp: "", supplierAddress: "", courierName: "", courierEmail: "", courierWhatsapp: "", teamEmail: "", teamWhatsapp: "" },
};

const t = (n: number) => z.string().max(n);
export const opsSchema = z.object({
  stock: z.object({ lowAt: z.number().int().min(0).max(10000), alertEmail: z.union([z.literal(""), z.string().email("Alert email: not a valid email")]), restockOnCancel: z.boolean() }),
  couriers: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,30}$/, "Courier id: lowercase letters, numbers and -"),
    name: t(60).min(1), phone: t(40),
    trackingUrl: z.union([z.literal(""), z.string().url("Tracking link must start with https://").max(300)]),
    api: z.enum(["", "aramex", "dhl", "track17"]).optional(),
  })).max(20),
  invoice: z.object({ title: t(40), businessName: t(120), taxId: t(60), footer: t(400) }),
  giftCards: z.object({ enabled: z.boolean(), validMonths: z.number().int().min(0).max(60) }),
  carts: z.object({ enabled: z.boolean(), afterHours: z.number().min(0.5).max(72), maxAgeHours: z.number().min(1).max(336) }),
  fulfil: z.object({
    enabled: z.boolean(), source: t(80), supplierName: t(80), supplierEmail: z.union([z.literal(""), z.string().email("Supplier email: not valid")]), supplierWhatsapp: t(30), supplierAddress: t(300),
    courierName: t(80), courierEmail: z.union([z.literal(""), z.string().email("Courier email: not valid")]), courierWhatsapp: t(30), teamEmail: z.union([z.literal(""), z.string().email("Team email: not valid")]), teamWhatsapp: t(30),
  }).default(defaultOps.fulfil),
});

export function withOpsDefaults(v: Partial<Ops> | null): Ops {
  const d = defaultOps;
  return {
    stock: { ...d.stock, ...v?.stock },
    couriers: v?.couriers?.length ? v.couriers : d.couriers,
    invoice: { ...d.invoice, ...v?.invoice },
    giftCards: { ...d.giftCards, ...v?.giftCards },
    carts: { ...d.carts, ...v?.carts },
    fulfil: { ...d.fulfil, ...v?.fulfil },
  };
}

export const trackingLink = (c: Courier | undefined, tracking: string) =>
  c?.trackingUrl && tracking ? (c.trackingUrl.includes("{tracking}") ? c.trackingUrl.replace("{tracking}", encodeURIComponent(tracking)) : c.trackingUrl + encodeURIComponent(tracking)) : "";
