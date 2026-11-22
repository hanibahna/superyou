// Services (bookable appointments) and events (sign-ups), Sephora-style. Client-safe.

import { z } from "zod";

export type Service = {
  id: string;
  title: string;
  category: string; // e.g. "Skin care", "Make up"
  description: string;
  duration: number; // minutes
  price: number; // 0 = free
  priceNote: string; // e.g. "Redeemable on products"
  image: string;
  enabled: boolean;
  /** Video calls: "no" = in store only, "yes" = customer chooses, "only" = video call only. */
  video?: "no" | "yes" | "only";
};

export type EventItem = {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string;
  location: string;
  image: string;
  capacity: number; // 0 = unlimited
  price: number;
  enabled: boolean;
};

export type ServicesConfig = {
  enabled: boolean;
  intro: string;
  location: string;
  hours: { day: number; open: string; close: string }[]; // day 0 = Sunday
  step: number; // minutes between start times
  staff: number; // bookings allowed at the same time
  leadHours: number; // earliest booking from now
  daysAhead: number;
  services: Service[];
  events: EventItem[];
};

const img = (f: string) => `https://cdn.shopify.com/s/files/1/${f}`;

export const defaultServices: ServicesConfig = {
  enabled: true,
  intro: "Free consultations and expert services with our pharmacists and beauty advisors. Book online in a minute.",
  location: "SuperYou beauty bar",
  hours: [1, 2, 3, 4, 5, 6].map((day) => ({ day, open: "10:00", close: "19:00" })),
  step: 30,
  staff: 2,
  leadHours: 3,
  daysAhead: 30,
  services: [
    { id: "video-consult", title: "Video call with a pharmacist", category: "Skin care", description: "A private video call from home: show your skin or your products and get advice and a routine. Opens right here on the site, nothing to install.", duration: 20, price: 0, priceNote: "Complimentary", image: "/brand/home/png/hero-pharmacist.png", enabled: true, video: "only" },
    { id: "skin-diagnosis", title: "Free skin diagnosis", category: "Skin care", description: "A pharmacist analyses your skin type and concerns and recommends a routine that fits your budget.", duration: 30, price: 0, priceNote: "Complimentary", image: img("1291/3633/files/Untitleddesign-2025-03-11T114540.671.png"), enabled: true },
    { id: "routine-consult", title: "Personal skincare routine", category: "Skin care", description: "Build a complete morning and evening routine, with samples to try at home.", duration: 45, price: 0, priceNote: "Complimentary", image: img("1291/3633/files/CeraVePackshots_1.png"), enabled: true },
    { id: "makeup-application", title: "Full makeup application", category: "Make up", description: "A full look for an evening or a special occasion, using the products of your choice.", duration: 60, price: 35, priceNote: "Redeemable on a same-day purchase", image: img("0295/0545/4173/files/lancome-hypnose-5-color-eyeshadow-palette-for-natural-to-dramatic-looks-5-highly-pigmented-and-longwear-eyeshadows-skin-society-shop-address-country-1.jpg"), enabled: true },
    { id: "mini-makeover", title: "Mini makeover", category: "Make up", description: "Eyes, lips or complexion: learn one look in 30 minutes.", duration: 30, price: 0, priceNote: "Complimentary", image: img("1291/3633/files/1-FireworkMascara.jpg"), enabled: true },
    { id: "fragrance-consult", title: "Fragrance consultation", category: "Fragrance", description: "Discover your signature scent with our fragrance expert and take home samples.", duration: 30, price: 0, priceNote: "Complimentary", image: img("0295/0545/4173/files/lancome-la-vie-est-belle-intensement-eau-de-parfum-intense-skin-society-shop-address-country-2.jpg"), enabled: true },
    { id: "scalp-diagnosis", title: "Hair & scalp diagnosis", category: "Hair", description: "Camera scalp check for hair loss, dandruff or sensitivity, with a care plan.", duration: 30, price: 0, priceNote: "Complimentary", image: img("1291/3633/files/Amber_2_b2eed6dc-4784-4d97-be47-4fa7aaa34778.png"), enabled: true },
    { id: "wellness-check", title: "Wellness check & supplement advice", category: "Health", description: "Blood pressure check and personalised vitamin and supplement advice from a pharmacist.", duration: 20, price: 0, priceNote: "Complimentary", image: img("0858/5451/9595/files/0074312516979.jpg"), enabled: true },
  ],
  events: [
    { id: "bf-vip-night", title: "Black Friday VIP night", description: "Early access to Black Friday prices, gift wrapping, mini makeovers and goodie bags for the first guests.", date: "2026-11-26", start: "18:00", end: "21:00", location: "SuperYou beauty bar", image: img("0295/0545/4173/files/updatedphoto_78bc8aff-3a3e-45fb-b7e9-c6bad88eca91.png"), capacity: 60, price: 0, enabled: true },
    { id: "skin-check-day", title: "Dermocosmetics skin check day", description: "Free skin checks with brand experts from La Roche-Posay, Vichy and CeraVe, plus samples.", date: "2026-12-05", start: "11:00", end: "17:00", location: "SuperYou beauty bar", image: img("0858/5451/9595/files/3337875797757-1.jpg"), capacity: 40, price: 0, enabled: true },
    { id: "holiday-makeup-class", title: "Holiday makeup masterclass", description: "Learn a festive glam look step by step. Includes a mini makeup kit to take home.", date: "2026-12-12", start: "17:00", end: "18:30", location: "SuperYou beauty bar", image: img("0295/0545/4173/files/estee-lauder-bronze-goddess-powder-bronzer-skin-society-shop-address-country-1.jpg"), capacity: 15, price: 25, enabled: true },
  ],
};

const time = z.string().regex(/^\d{2}:\d{2}$/);
export const servicesSchema = z.object({
  enabled: z.boolean(),
  intro: z.string().max(500),
  location: z.string().max(200),
  hours: z.array(z.object({ day: z.number().int().min(0).max(6), open: time, close: time })).max(14),
  step: z.number().int().min(10).max(120),
  staff: z.number().int().min(1).max(50),
  leadHours: z.number().min(0).max(240),
  daysAhead: z.number().int().min(1).max(180),
  services: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/).max(60), title: z.string().min(1).max(100), category: z.string().max(40), description: z.string().max(1000),
    duration: z.number().int().min(5).max(480), price: z.number().min(0).max(10000), priceNote: z.string().max(100), image: z.string().max(500), enabled: z.boolean(),
    video: z.enum(["no", "yes", "only"]).optional(),
  })).max(100),
  events: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/).max(60), title: z.string().min(1).max(120), description: z.string().max(2000),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: time, end: time, location: z.string().max(200), image: z.string().max(500),
    capacity: z.number().int().min(0).max(100000), price: z.number().min(0).max(10000), enabled: z.boolean(),
  })).max(200),
});

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Start times for a service on a date (store-local), before removing taken ones. */
export function slotsFor(cfg: ServicesConfig, s: Service, date: string): string[] {
  const d = new Date(`${date}T12:00:00`);
  const out: string[] = [];
  for (const h of cfg.hours.filter((x) => x.day === d.getDay())) {
    for (let m = mins(h.open); m + s.duration <= mins(h.close); m += cfg.step) out.push(hhmm(m));
  }
  return out;
}

/** True if two bookings overlap. */
export const overlaps = (aStart: string, aDur: number, bStart: string, bDur: number) => mins(aStart) < mins(bStart) + bDur && mins(bStart) < mins(aStart) + aDur;

export type Booking = {
  id: string;
  kind: "service" | "event";
  refId: string; // service or event id
  title: string;
  date: string;
  time: string;
  duration: number;
  name: string;
  phone: string;
  email: string;
  guests: number;
  notes: string;
  status: "pending" | "confirmed" | "cancelled" | "done" | "no-show";
  createdAt: string;
  /** "video" = a video call inside the site (lib/video.ts); in store otherwise. */
  mode?: "store" | "video";
  access?: string; // secret for the customer's call link
  video?: { provider: string; roomUrl: string; hostUrl: string; createdAt: string };
};

/** Message variables for booking messages. */
export function bookingVars(b: Booking): Record<string, string> {
  return {
    first_name: b.name.split(" ")[0], name: b.name, service: b.title, time: b.time,
    call_link: b.mode === "video" && b.access ? `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.shopsuperyou.com"}/call/${b.id}/?t=${b.access}` : "",
    date: new Date(`${b.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
  };
}
