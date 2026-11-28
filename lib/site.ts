// Store settings and homepage layout: types, defaults and validation.
// Client-safe (no server imports). Stored in the database, edited in Admin → Settings / Homepage.

import { z } from "zod";

// ── Store settings ──────────────────────────────────────────

export type DeliveryZone = { name: string; fee?: number };

export type MenuItem = { label: string; href: string; children: MenuItem[]; highlight?: boolean; image?: string };

export type Settings = {
  menu: MenuItem[]; // empty = built from categories & concerns
  footerMenu: { title: string; links: { label: string; href: string }[] }[]; // empty = automatic
  store: {
    name: string;
    tagline: string;
    phone: string;
    whatsapp: string; // digits only, international format
    email: string;
    address: string;
    openingHours: string;
  };
  social: { instagram: string; facebook: string; tiktok: string; youtube: string };
  announcement: { enabled: boolean; text: string; link: string; showContacts: boolean };
  delivery: { fee: number; freeThreshold: number; estimate: string; zones: DeliveryZone[] };
  payments: {
    cod: { enabled: boolean; label: string; description: string };
    card: { enabled: boolean; label: string; description: string };
    whish: { enabled: boolean; label: string; description: string };
  };
  seo: { title: string; description: string };
  trust: { title: string; text: string }[];
  pages: Record<string, { title: string; body: string; footer?: boolean }>;
  checkout: { minOrder: number; note: string };
};

export const defaultSettings: Settings = {
  menu: [],
  footerMenu: [],
  store: {
    name: "SuperYou",
    tagline: "Reveal the super in you",
    phone: "+961 70 777 608",
    whatsapp: "96170777608",
    email: "order@shopsuperyou.com",
    address: "Beirut, Lebanon",
    openingHours: "Mon–Sat 9:00–19:00",
  },
  social: { instagram: "", facebook: "", tiktok: "https://www.tiktok.com/@pharmatipss", youtube: "" },
  announcement: { enabled: true, text: "Free delivery on orders over $100 · Free sample with every order over $100", link: "", showContacts: true },
  delivery: {
    fee: 4,
    freeThreshold: 100,
    estimate: "1–3 working days. We'll call before arriving.",
    zones: ["Beirut", "Metn", "Keserwan", "Jbeil", "Baabda", "Aley", "Chouf", "North Lebanon", "South Lebanon", "Bekaa"].map((name) => ({ name })),
  },
  payments: {
    cod: { enabled: true, label: "Cash on delivery", description: "Pay the driver in USD or LBP when your order arrives." },
    card: { enabled: true, label: "Credit / debit card", description: "Visa or Mastercard, processed on a secure 3-D Secure page." },
    whish: { enabled: true, label: "Whish Money", description: "We'll send you a Whish payment request to confirm your order." },
  },
  seo: { title: "", description: "" },
  trust: [
    { title: "100% authentic", text: "Sealed, genuine brand products" },
    { title: "Fast delivery", text: "All over Lebanon · free over $100" },
    { title: "Rewards", text: "Earn points on every order" },
    { title: "Pharmacist advice", text: "Ask us on WhatsApp" },
  ],
  pages: {
    delivery: {
      title: "Delivery & returns",
      body: "We deliver across Lebanon in 1–3 working days. Delivery is $4, free on orders over $100 (every order for SuperPrime members).\n\nUnopened products can be returned within 7 days of delivery.",
    },
    payment: { title: "Payment methods", body: "Cash on delivery\nVisa / Mastercard (secure card payment)\nWhish Money" },
    rewards: { title: "Rewards program", body: "Earn 1 point per $1 spent. 100 points = $5 off." },
    about: { title: "About us", body: "SuperYou is an online parapharmacy for skincare, beauty, health and supplements." },
    privacy: { title: "Privacy policy", body: "We only use your details to process and deliver your orders." },
    contact: { title: "Contact us", body: "" }, // empty → phone, email, address and hours from Settings
  },
  checkout: { minOrder: 0, note: "" },
};

const text = (max: number) => z.string().max(max);
const url = z.union([z.literal(""), z.string().url().max(500)]);
const method = z.object({ enabled: z.boolean(), label: text(60).min(1), description: text(200) });

const menuLeaf = z.object({ label: text(80).min(1), href: text(300), highlight: z.boolean().optional(), image: text(500).optional() });
const menuItem: z.ZodType<MenuItem> = menuLeaf.extend({ children: z.lazy(() => z.array(menuItem).max(80)) }) as z.ZodType<MenuItem>;

export const settingsSchema = z.object({
  menu: z.array(menuItem).max(30).default([]),
  footerMenu: z.array(z.object({ title: text(60), links: z.array(z.object({ label: text(80).min(1), href: text(300) })).max(40) })).max(6).default([]),
  store: z.object({
    name: text(60).min(1), tagline: text(120), phone: text(40), whatsapp: z.string().regex(/^\d{0,15}$/, "WhatsApp: digits only, e.g. 9613123456"),
    email: text(120), address: text(200), openingHours: text(120),
  }),
  social: z.object({ instagram: url, facebook: url, tiktok: url, youtube: url }),
  announcement: z.object({ enabled: z.boolean(), text: text(200), link: text(300), showContacts: z.boolean() }),
  delivery: z.object({
    fee: z.number().min(0).max(1000), freeThreshold: z.number().min(0).max(100000), estimate: text(200),
    zones: z.array(z.object({ name: text(60).min(1), fee: z.number().min(0).max(1000).optional() })).min(1).max(100),
  }),
  payments: z.object({ cod: method, card: method, whish: method }),
  seo: z.object({ title: text(120), description: text(300) }),
  trust: z.array(z.object({ title: text(60), text: text(120) })).max(4),
  pages: z.record(z.string().regex(/^[a-z0-9-]+$/), z.object({ title: text(150).min(1), body: text(20000), footer: z.boolean().optional() })),
  checkout: z.object({ minOrder: z.number().min(0).max(100000), note: text(300) }),
});

/** Fill in anything missing from a stored (possibly older) settings object. */
export function withDefaults(s: Partial<Settings> | null | undefined): Settings {
  const d = defaultSettings;
  if (!s) return d;
  return {
    menu: s.menu ?? d.menu,
    footerMenu: s.footerMenu ?? d.footerMenu,
    // The old default tagline gives way to the brand tagline; a tagline typed in Admin is kept.
    store: { ...d.store, ...s.store, tagline: !s.store?.tagline || s.store.tagline === "Your trusted online parapharmacy" ? d.store.tagline : s.store.tagline },
    social: { ...d.social, ...s.social },
    announcement: { ...d.announcement, ...s.announcement },
    delivery: { ...d.delivery, ...s.delivery },
    payments: {
      cod: { ...d.payments.cod, ...s.payments?.cod },
      card: { ...d.payments.card, ...s.payments?.card },
      whish: { ...d.payments.whish, ...s.payments?.whish },
    },
    seo: { ...d.seo, ...s.seo },
    trust: s.trust ?? d.trust,
    pages: s.pages ?? d.pages,
    checkout: { ...d.checkout, ...s.checkout },
  };
}

export function deliveryFor(s: Settings, subtotal: number, zone?: string) {
  if (subtotal === 0 || (s.delivery.freeThreshold > 0 && subtotal >= s.delivery.freeThreshold)) return 0;
  const z = zone ? s.delivery.zones.find((x) => x.name === zone) : undefined;
  return z?.fee ?? s.delivery.fee;
}

// ── Homepage sections ───────────────────────────────────────

export type Slide = {
  eyebrow: string; title: string; text: string; cta: string; href: string;
  image: string; // optional photo shown on the right (or full background when "cover")
  video: string; // optional background video (mp4/webm link or upload)
  layout: "split" | "cover";
  from: string; to: string; // gradient colours when no photo/video covers the slide
};

export type ProductSource = { kind: "tag" | "category" | "brand" | "concern" | "search" | "skus" | "newest" | "sale" | "collection"; value: string };

export type Section = SectionCommon & (
  | { id: string; type: "hero"; enabled: boolean; slides: Slide[]; interval: number; height: "small" | "medium" | "large" }
  | { id: string; type: "countdown"; enabled: boolean; eyebrow: string; title: string; endsAt: string; href: string }
  | { id: string; type: "products"; enabled: boolean; eyebrow: string; title: string; source: ProductSource; limit: number; sort: "featured" | "price-asc" | "discount" | "new"; layout: "carousel" | "grid" }
  | { id: string; type: "categories"; enabled: boolean; eyebrow: string; title: string; slugs: string[] }
  | { id: string; type: "concerns"; enabled: boolean; eyebrow: string; title: string }
  | { id: string; type: "brands"; enabled: boolean; title: string; brands: string[]; limit: number; logos?: { brand: string; image: string }[] }
  | { id: string; type: "reviews"; enabled: boolean; eyebrow: string; title: string; minRating: number; limit: number }
  | { id: string; type: "banners"; enabled: boolean; title: string; columns: 1 | 2 | 3; items: { image: string; video: string; title: string; text: string; href: string }[] }
  | { id: string; type: "video"; enabled: boolean; eyebrow: string; title: string; text: string; url: string; poster: string; autoplay: boolean; cta: string; href: string }
  | { id: string; type: "text"; enabled: boolean; eyebrow: string; title: string; body: string; align: "left" | "center"; cta: string; href: string; background: "none" | "soft" | "dark" }
  | { id: string; type: "newsletter"; enabled: boolean; title: string; text: string }
  | { id: string; type: "bfhero"; enabled: boolean; eyebrow: string; title: string; text: string; badge: string; cta: string; href: string; cta2: string; href2: string; endsAt: string; images: Tile[]; slider?: { enabled: boolean; source: ProductSource; limit: number; interval: number }; video?: string; poster?: string; overlay?: number }
  | { id: string; type: "tiles"; enabled: boolean; eyebrow: string; title: string; items: Tile[] }
  | { id: string; type: "circles"; enabled: boolean; title: string; items: Tile[] }
  | { id: string; type: "offers"; enabled: boolean; eyebrow: string; title: string; items: Tile[] }
  | { id: string; type: "social"; enabled: boolean; eyebrow: string; title: string; source: "library" | "tiktok-profile"; handle: string; filter: { categories: string[]; brands: string[] }; limit: number; display?: "players" | "cards" | "shoppable" });

/** A picture card: promo tile, round category image, offer card or Black Friday collage item. */
export type Tile = { image: string; title: string; text: string; cta: string; href: string; bg: string; badge: string };
export const emptyTile = (): Tile => ({ image: "", title: "Title", text: "", cta: "Shop now", href: "/shop/", bg: "#f5f0eb", badge: "" });

export type SectionType = Section["type"];
/** Options every homepage section can have. */
export type SectionCommon = { hideOnMobile?: boolean };
export type Landing = { sections: Section[] };

export const sectionLabels: Record<SectionType, { label: string; hint: string }> = {
  reviews: { label: "Customer reviews", hint: "Latest 4–5 star reviews with the product. Hidden until there are at least 3." },
  bfhero: { label: "Campaign hero", hint: "Black Friday style: big bold headline, product collage, countdown" },
  tiles: { label: "Promo cards", hint: "Sephora-style row of picture cards with headline and link" },
  circles: { label: "Round category pictures", hint: "Circles with a product photo and a label" },
  offers: { label: "Offers grid", hint: "Offer cards: picture, title, details and link" },
  hero: { label: "Hero slider", hint: "Big rotating banners with photo or video" },
  countdown: { label: "Countdown", hint: "Timer for a sale or happy hour" },
  products: { label: "Product row", hint: "Deals, a category, a brand, search results or hand-picked SKUs" },
  categories: { label: "Category tiles", hint: "Picture tiles linking to categories" },
  concerns: { label: "Shop by concern", hint: "Skin / hair / wellness concern tiles" },
  brands: { label: "Brand strip", hint: "Scrolling list of brands" },
  banners: { label: "Promo banners", hint: "1–3 image or video banners side by side" },
  video: { label: "Video", hint: "Uploaded video, YouTube or Vimeo" },
  text: { label: "Text block", hint: "Heading, paragraph and button" },
  newsletter: { label: "Newsletter sign-up", hint: "Collect emails (Admin → Subscribers)" },
  social: { label: "Social videos", hint: "Videos from your library, or your TikTok profile feed" },
};

export const newId = () => Math.random().toString(36).slice(2, 9);

export const emptySlide = (): Slide => ({
  eyebrow: "", title: "New slide", text: "", cta: "Shop now", href: "/shop/", image: "", video: "", layout: "split", from: "#2e2229", to: "#c0587a",
});

export function newSection(type: SectionType): Section {
  const id = newId();
  switch (type) {
    case "hero": return { id, type, enabled: true, slides: [emptySlide()], interval: 6, height: "medium" };
    case "countdown": return { id, type, enabled: true, eyebrow: "Catch the happy hour!", title: "Shop now before the clock runs out", endsAt: "", href: "/shop/?tag=deal" };
    case "products": return { id, type, enabled: true, eyebrow: "", title: "New product row", source: { kind: "tag", value: "favorite" }, limit: 16, sort: "featured", layout: "carousel" };
    case "categories": return { id, type, enabled: true, eyebrow: "Browse", title: "Shop by category", slugs: [] };
    case "concerns": return { id, type, enabled: true, eyebrow: "Got concerns? We got you", title: "Shop by concern" };
    case "brands": return { id, type, enabled: true, title: "Shop by brand", brands: [], limit: 24, logos: [] };
    case "reviews": return { id, type, enabled: true, eyebrow: "Real reviews", title: "Loved by our customers", minRating: 4, limit: 8 };
    case "banners": return { id, type, enabled: true, title: "", columns: 2, items: [{ image: "", video: "", title: "Banner title", text: "", href: "/shop/" }] };
    case "video": return { id, type, enabled: true, eyebrow: "", title: "", text: "", url: "", poster: "", autoplay: false, cta: "", href: "" };
    case "text": return { id, type, enabled: true, eyebrow: "", title: "Heading", body: "", align: "center", cta: "", href: "", background: "soft" };
    case "newsletter": return { id, type, enabled: true, title: "Join our newsletter", text: "Offers, new arrivals and skincare tips. No spam." };
    case "bfhero": return { id, type, enabled: true, eyebrow: "Black Friday 2026", title: "Up to 50% off", text: "", badge: "", cta: "Shop the sale", href: "/collections/value-deals/", cta2: "", href2: "", endsAt: "", images: [emptyTile(), emptyTile(), emptyTile(), emptyTile()], slider: { enabled: true, source: { kind: "sale", value: "" }, limit: 12, interval: 3.5 } };
    case "tiles": return { id, type, enabled: true, eyebrow: "", title: "", items: [emptyTile(), emptyTile(), emptyTile(), emptyTile()] };
    case "circles": return { id, type, enabled: true, title: "Shop by category", items: [emptyTile(), emptyTile(), emptyTile(), emptyTile(), emptyTile(), emptyTile()] };
    case "offers": return { id, type, enabled: true, eyebrow: "", title: "Beauty offers", items: [emptyTile(), emptyTile(), emptyTile()] };
    case "social": return { id, type, enabled: true, eyebrow: "Pharmacist tips", title: "Watch & shop", source: "library", handle: "pharmatipss", filter: { categories: [], brands: [] }, limit: 12 };
  }
}

const p = (eyebrow: string, title: string, tag: string): Section => ({
  id: `p-${tag}`, type: "products", enabled: true, eyebrow, title, source: { kind: "tag", value: tag }, limit: 16, sort: "featured", layout: "carousel",
});

/** The original homepage, used until the admin saves their own layout. */
export const defaultLanding: Landing = {
  sections: [
    {
      id: "hero", type: "hero", enabled: true, interval: 6, height: "medium",
      slides: [
        { eyebrow: "Black November", title: "Buy 1, get 1 at 35% off", text: "On selected dermo-cosmetic brands", cta: "Shop the offer", href: "/shop/?sort=discount", image: "", video: "", layout: "split", from: "#2e2229", to: "#c0587a" },
        { eyebrow: "New in", title: "Supplements for every routine", text: "Vitamins, collagen, sleep and immunity", cta: "Explore wellness", href: "/shop/?category=supplements", image: "", video: "", layout: "split", from: "#3a2a55", to: "#8a6fc2" },
        { eyebrow: "Sun season", title: "SPF50+ essentials", text: "Up to 40% off sun protection", cta: "Shop suncare", href: "/shop/?category=suncare", image: "", video: "", layout: "split", from: "#7a4b12", to: "#f0a33a" },
      ],
    },
    { id: "countdown", type: "countdown", enabled: true, eyebrow: "Catch the happy hour!", title: "Shop now before the clock runs out", endsAt: "", href: "/shop/?tag=deal" },
    p("Happy hour", "Today's deals", "deal"),
    p("Mega deals", "Save up to 50%", "mega"),
    { id: "categories", type: "categories", enabled: true, eyebrow: "Browse", title: "Shop by category", slugs: [] },
    { id: "concerns", type: "concerns", enabled: true, eyebrow: "Got concerns? We got you", title: "Shop by concern" },
    p("Customer favorites", "Your favorites, all in one place", "favorite"),
    p("Just landed", "Beauty's newest essentials", "new"),
    p("More to love", "Sets, bundles & gifts", "bundle"),
    p("Half price deals", "Your favorites at special prices", "half"),
    { id: "brands", type: "brands", enabled: true, title: "Shop by brand", brands: [], limit: 24 },
    { id: "social", type: "social", enabled: true, eyebrow: "Pharmacist tips", title: "Watch on TikTok @pharmatipss", source: "tiktok-profile", handle: "pharmatipss", filter: { categories: [], brands: [] }, limit: 12 },
    { id: "newsletter", type: "newsletter", enabled: false, title: "Join our newsletter", text: "Offers, new arrivals and skincare tips. No spam." },
  ],
};

// Lenient validation: types and sizes are checked, unknown fields dropped.
const str = (max = 500) => z.string().max(max);
const slideSchema = z.object({
  eyebrow: str(80), title: str(120), text: str(300), cta: str(40), href: str(300), image: str(), video: str(),
  layout: z.enum(["split", "cover"]), from: str(20), to: str(20),
});
const base = { id: z.string().min(1).max(40), enabled: z.boolean(), hideOnMobile: z.boolean().optional() };
const tileSchema = z.object({ image: str(), title: str(120), text: str(300), cta: str(40), href: str(300), bg: str(20), badge: str(40) });
export const landingSchema = z.object({
  sections: z.array(
    z.discriminatedUnion("type", [
      z.object({ ...base, type: z.literal("hero"), slides: z.array(slideSchema).min(1).max(10), interval: z.number().min(2).max(60), height: z.enum(["small", "medium", "large"]) }),
      z.object({ ...base, type: z.literal("countdown"), eyebrow: str(80), title: str(120), endsAt: str(40), href: str(300) }),
      z.object({
        ...base, type: z.literal("products"), eyebrow: str(80), title: str(120),
        source: z.object({ kind: z.enum(["tag", "category", "brand", "concern", "search", "skus", "newest", "sale", "collection"]), value: str(5000) }),
        limit: z.number().int().min(1).max(48), sort: z.enum(["featured", "price-asc", "discount", "new"]), layout: z.enum(["carousel", "grid"]),
      }),
      z.object({ ...base, type: z.literal("categories"), eyebrow: str(80), title: str(120), slugs: z.array(str(80)).max(50) }),
      z.object({ ...base, type: z.literal("concerns"), eyebrow: str(80), title: str(120) }),
      z.object({ ...base, type: z.literal("brands"), title: str(120), brands: z.array(str(80)).max(100), limit: z.number().int().min(1).max(100), logos: z.array(z.object({ brand: str(80), image: str(500) })).max(200).optional() }),
      z.object({ ...base, type: z.literal("reviews"), eyebrow: str(80), title: str(120), minRating: z.number().int().min(1).max(5), limit: z.number().int().min(3).max(24) }),
      z.object({
        ...base, type: z.literal("banners"), title: str(120), columns: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        items: z.array(z.object({ image: str(), video: str(), title: str(120), text: str(300), href: str(300) })).min(1).max(6),
      }),
      z.object({ ...base, type: z.literal("video"), eyebrow: str(80), title: str(120), text: str(500), url: str(), poster: str(), autoplay: z.boolean(), cta: str(40), href: str(300) }),
      z.object({ ...base, type: z.literal("text"), eyebrow: str(80), title: str(120), body: str(5000), align: z.enum(["left", "center"]), cta: str(40), href: str(300), background: z.enum(["none", "soft", "dark"]) }),
      z.object({ ...base, type: z.literal("newsletter"), title: str(120), text: str(300) }),
      z.object({ ...base, type: z.literal("bfhero"), eyebrow: str(80), title: str(120), text: str(300), badge: str(160), cta: str(40), href: str(300), cta2: str(40), href2: str(300), endsAt: str(40), images: z.array(tileSchema).max(8), video: z.string().max(500).optional(), poster: z.string().max(500).optional(), overlay: z.number().min(0).max(90).optional(),
        slider: z.object({ enabled: z.boolean(), source: z.object({ kind: z.enum(["tag", "category", "brand", "concern", "search", "skus", "newest", "sale", "collection"]), value: str(5000) }), limit: z.number().int().min(3).max(24), interval: z.number().min(2).max(15) }).optional() }),
      z.object({ ...base, type: z.literal("tiles"), eyebrow: str(80), title: str(120), items: z.array(tileSchema).min(1).max(16) }),
      z.object({ ...base, type: z.literal("circles"), title: str(120), items: z.array(tileSchema).min(1).max(16) }),
      z.object({ ...base, type: z.literal("offers"), eyebrow: str(80), title: str(120), items: z.array(tileSchema).min(1).max(12) }),
      z.object({
        ...base, type: z.literal("social"), eyebrow: str(80), title: str(120), source: z.enum(["library", "tiktok-profile"]), handle: z.string().regex(/^@?[\w.]{0,40}$/),
        filter: z.object({ categories: z.array(str(80)).max(30), brands: z.array(str(80)).max(30) }), limit: z.number().int().min(1).max(48),
        display: z.enum(["players", "cards", "shoppable"]).optional(),
      }),
    ]),
  ).max(40),
});

// ── Video links ─────────────────────────────────────────────

export type VideoInfo = { kind: "youtube" | "vimeo" | "tiktok" | "instagram" | "facebook"; embed: string; vertical?: boolean } | { kind: "file"; src: string } | null;

export type Platform = "youtube" | "vimeo" | "tiktok" | "instagram" | "facebook" | "file";

export function platformOf(url: string): Platform | null {
  const v = parseVideo(url);
  return v ? v.kind : null;
}

/** Turns a YouTube/Vimeo page link or a direct video file link into something playable. */
export function parseVideo(url: string, opts: { autoplay?: boolean; background?: boolean } = {}): VideoInfo {
  const u = url.trim();
  if (!u) return null;
  const auto = opts.autoplay || opts.background;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) {
    const q = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1" });
    if (auto) q.set("autoplay", "1"), q.set("mute", "1");
    if (opts.background) q.set("controls", "0"), q.set("loop", "1"), q.set("playlist", yt[1]);
    return { kind: "youtube", embed: `https://www.youtube-nocookie.com/embed/${yt[1]}?${q}` };
  }
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) {
    const q = new URLSearchParams({ dnt: "1" });
    if (auto) q.set("autoplay", "1"), q.set("muted", "1");
    if (opts.background) q.set("background", "1"), q.set("loop", "1");
    return { kind: "vimeo", embed: `https://player.vimeo.com/video/${vm[1]}?${q}` };
  }
  const tt = u.match(/tiktok\.com\/(?:@[\w.-]+\/video|embed(?:\/v2)?|v)\/(\d+)/);
  if (tt) {
    // TikTok's official embed player (plays in place, no TikTok page chrome).
    const q = new URLSearchParams({ controls: "1", progress_bar: "1", play_button: "1", volume_control: "1", fullscreen_button: "1", music_info: "0", description: "0", rel: "0" });
    if (auto) q.set("autoplay", "1");
    if (opts.background) q.set("loop", "1"), q.set("controls", "0");
    return { kind: "tiktok", embed: `https://www.tiktok.com/player/v1/${tt[1]}?${q}`, vertical: true };
  }
  const ig = u.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/);
  if (ig) return { kind: "instagram", embed: `https://www.instagram.com/${ig[1] === "reels" ? "reel" : ig[1]}/${ig[2]}/embed`, vertical: true };
  if (/facebook\.com\/.+\/videos\/|facebook\.com\/(watch|reel)|fb\.watch\//.test(u))
    return { kind: "facebook", embed: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&show_text=false`, vertical: /\/reel\//.test(u) };
  if (/^https?:\/\/.+\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(u) || /blob\.vercel-storage\.com\//.test(u)) return { kind: "file", src: u };
  if (/^https?:\/\//i.test(u)) return { kind: "file", src: u };
  return null;
}

// ── Video library (social videos shown by category / brand / concern / product) ──

export type VideoItem = {
  id: string;
  url: string; // YouTube, TikTok, Instagram, Facebook, Vimeo link or an uploaded file
  title: string;
  thumbnail: string;
  categories: string[]; // category slugs
  brands: string[];
  concerns: string[]; // concern slugs
  products: string[]; // product slugs ("shop the video")
  enabled: boolean;
  source?: string; // e.g. "youtube:UC…" when auto-imported from a channel
  addedAt: string;
};

export type VideoLibrary = {
  items: VideoItem[];
  channels: { platform: "youtube"; id: string; name: string; autoTag: boolean; lastSync?: string }[];
  show: { category: boolean; brand: boolean; product: boolean; search: boolean };
};

export const defaultVideoLibrary: VideoLibrary = { items: [], channels: [], show: { category: true, brand: true, product: true, search: false } };

export const videoLibrarySchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1).max(40), url: z.string().url().max(500), title: z.string().max(200), thumbnail: z.string().max(500),
    categories: z.array(z.string().max(80)).max(50), brands: z.array(z.string().max(80)).max(50),
    concerns: z.array(z.string().max(80)).max(50), products: z.array(z.string().max(200)).max(50),
    enabled: z.boolean(), source: z.string().max(100).optional(), addedAt: z.string().max(40),
  })).max(2000),
  channels: z.array(z.object({ platform: z.literal("youtube"), id: z.string().regex(/^UC[\w-]{10,40}$/, "YouTube channel id starts with UC"), name: z.string().max(100), autoTag: z.boolean(), lastSync: z.string().max(40).optional() })).max(20),
  show: z.object({ category: z.boolean(), brand: z.boolean(), product: z.boolean(), search: z.boolean() }),
});

// ── Search settings (modelled on Shopify Search & Discovery) ──

export type SearchSettings = {
  synonyms: string[][]; // each group: words that mean the same, e.g. ["sunscreen","sunblock","spf"]
  boosts: { terms: string[]; slugs: string[] }[]; // pin these items to the top for these searches
  hidden: string[]; // item slugs never shown in search results
  redirects: { term: string; url: string }[]; // exact search → page (e.g. "cerave" → /shop/?brand=CeraVe)
  stopWords: string[];
  fields: { name: boolean; brand: boolean; category: boolean; concerns: boolean; variant: boolean; sku: boolean; barcode: boolean };
  typoTolerance: boolean;
  outOfStock: "show" | "last" | "hide";
  predictive: boolean; // suggestions while typing
  popular: string[]; // shown under the search box and on "no results"
  filters: { category: boolean; concern: boolean; brand: boolean; price: boolean; availability: boolean; onSale: boolean };
  perPage: number;
  defaultSort: "featured" | "price-asc" | "price-desc" | "discount" | "new";
};

export const defaultSearchSettings: SearchSettings = {
  synonyms: [
    ["sunscreen", "sunblock", "spf", "sun cream"],
    ["moisturizer", "moisturiser", "hydrating cream"],
    ["vitamin c", "ascorbic"],
    ["acne", "spots", "pimples", "blemish"],
    ["hair loss", "hair fall", "thinning", "تساقط"],
    // Arabic and Franco-Arabic words people type in Lebanon
    ["cream", "krem", "creme", "كريم"],
    ["sunscreen", "spf", "واقي", "شمس"],
    ["serum", "سيروم"],
    ["shampoo", "shampoing", "شامبو"],
    ["perfume", "parfum", "عطر"],
    ["mascara", "ماسكارا"],
    ["lipstick", "rouge", "أحمر"],
    ["acne", "hboub", "حبوب"],
    ["vitamin", "فيتامين"],
    ["baby", "bebe", "طفل"],
    ["foundation", "fond de teint", "كريم أساس"],
  ],
  boosts: [],
  hidden: [],
  redirects: [],
  stopWords: ["the", "for", "and", "with", "a", "an", "of"],
  fields: { name: true, brand: true, category: true, concerns: true, variant: true, sku: true, barcode: true },
  typoTolerance: true,
  outOfStock: "last",
  predictive: true,
  popular: ["Sunscreen", "Vitamin C", "CeraVe", "La Roche-Posay", "Collagen", "Hair loss"],
  filters: { category: true, concern: true, brand: true, price: true, availability: true, onSale: true },
  perPage: 48,
  defaultSort: "featured",
};

export const searchSettingsSchema = z.object({
  synonyms: z.array(z.array(z.string().min(1).max(60)).min(2).max(20)).max(500),
  boosts: z.array(z.object({ terms: z.array(z.string().min(1).max(60)).min(1).max(10), slugs: z.array(z.string().max(200)).min(1).max(20) })).max(300),
  hidden: z.array(z.string().max(200)).max(2000),
  redirects: z.array(z.object({ term: z.string().min(1).max(80), url: z.string().min(1).max(300) })).max(300),
  stopWords: z.array(z.string().max(30)).max(200),
  fields: z.object({ name: z.boolean(), brand: z.boolean(), category: z.boolean(), concerns: z.boolean(), variant: z.boolean(), sku: z.boolean(), barcode: z.boolean() }),
  typoTolerance: z.boolean(),
  outOfStock: z.enum(["show", "last", "hide"]),
  predictive: z.boolean(),
  popular: z.array(z.string().max(60)).max(20),
  filters: z.object({ category: z.boolean(), concern: z.boolean(), brand: z.boolean(), price: z.boolean(), availability: z.boolean(), onSale: z.boolean() }),
  perPage: z.number().int().min(12).max(96),
  defaultSort: z.enum(["featured", "price-asc", "price-desc", "discount", "new"]),
});

// ── Promotions: discounts, coupon codes and free gifts ──

export type Scope = { kind: "all" | "category" | "brand" | "concern" | "tag" | "skus"; values: string[] };

export type Discount = {
  id: string;
  name: string; // shown to customers, e.g. "15% off La Roche-Posay"
  enabled: boolean;
  type: "percent" | "fixed"; // fixed = amount off each item
  value: number;
  scope: Scope;
  exclude: Scope; // e.g. exclude a brand from a sitewide sale
  code: string; // empty = automatic (shown as sale price everywhere); otherwise a coupon code entered at checkout
  minSubtotal: number;
  startsAt: string; // ISO, empty = now
  endsAt: string; // ISO, empty = no end
  stack: boolean; // coupon on top of automatic sale prices
  usageLimit: number; // 0 = unlimited (coupons)
  used: number;
};

export type GiftTier = {
  id: string;
  name: string; // e.g. "Free travel-size cleanser"
  enabled: boolean;
  minSubtotal: number; // spend at least this…
  scope: Scope; // …on these products (all = whole cart)
  choices: string[]; // product SKUs the customer can choose from
  pick: number; // how many they can choose
  startsAt: string;
  endsAt: string;
  showProgress: boolean; // "Spend $12 more to get a free gift"
};

/** paused = the master switch is off: automatic sales, Black Friday prices, min-spend discounts and
 *  promo codes from Discounts & codes all stop (rules are kept). Personal codes still work. */
export type Promotions = { discounts: Discount[]; gifts: GiftTier[]; paused?: boolean };
/** The store's own discount rules that may apply now (none while the master switch is off). */
export const storeDiscounts = (p: Promotions) => (p.paused ? [] : p.discounts);
export const defaultPromotions: Promotions = { discounts: [], gifts: [] };

const scopeSchema = z.object({ kind: z.enum(["all", "category", "brand", "concern", "tag", "skus"]), values: z.array(z.string().max(200)).max(2000) });
export const promotionsSchema = z.object({
  paused: z.boolean().optional(),
  discounts: z.array(z.object({
    id: z.string().min(1).max(40), name: z.string().min(1).max(100), enabled: z.boolean(), type: z.enum(["percent", "fixed"]),
    value: z.number().positive().max(100000), scope: scopeSchema, exclude: scopeSchema,
    code: z.string().max(40).regex(/^[A-Za-z0-9_-]*$/, "Codes: letters, numbers, - and _ only"),
    minSubtotal: z.number().min(0).max(100000), startsAt: z.string().max(40), endsAt: z.string().max(40), stack: z.boolean(),
    usageLimit: z.number().int().min(0).max(1000000), used: z.number().int().min(0),
  }).refine((d) => d.type !== "percent" || d.value <= 100, "Percent discounts can't exceed 100")).max(300),
  gifts: z.array(z.object({
    id: z.string().min(1).max(40), name: z.string().min(1).max(100), enabled: z.boolean(), minSubtotal: z.number().min(0).max(100000),
    scope: scopeSchema, choices: z.array(z.string().max(100)).min(1).max(30), pick: z.number().int().min(1).max(10),
    startsAt: z.string().max(40), endsAt: z.string().max(40), showProgress: z.boolean(),
  })).max(50),
});

export const isLive = (r: { enabled: boolean; startsAt: string; endsAt: string }, now = Date.now()) =>
  r.enabled && (!r.startsAt || Date.parse(r.startsAt) <= now) && (!r.endsAt || Date.parse(r.endsAt) > now);

type ScopedItem = { category: string; feedCategory?: string; brand: string; concerns: string[]; tags: string[]; sku: string };
export function inScope(p: ScopedItem, s: Scope) {
  const v = s.values;
  switch (s.kind) {
    case "all": return true;
    // Products regrouped by the shop (Baby & Mom, Supplements) still count for their feed category.
    case "category": return v.includes(p.category) || (!!p.feedCategory && v.includes(p.feedCategory));
    case "brand": return v.some((b) => b.toLowerCase() === p.brand.toLowerCase());
    case "concern": return p.concerns.some((c) => v.includes(c));
    case "tag": return p.tags.some((t) => v.includes(t));
    case "skus": return v.some((x) => x.toLowerCase() === p.sku.toLowerCase());
  }
}
const excluded = (p: ScopedItem, s: Scope) => s.values.length > 0 && s.kind !== "all" && inScope(p, s);

/** Best automatic sale price for one product. Returns the original price when nothing applies. */
export function salePrice<T extends ScopedItem & { price: number; compareAt?: number }>(p: T, discounts: Discount[], now = Date.now()) {
  let best = p.price;
  let rule: Discount | undefined;
  for (const d of discounts) {
    if (d.code || d.minSubtotal > 0 || !isLive(d, now) || !inScope(p, d.scope) || excluded(p, d.exclude)) continue;
    const price = Math.max(0, d.type === "percent" ? p.price * (1 - d.value / 100) : p.price - d.value);
    if (price < best) (best = price), (rule = d);
  }
  if (!rule) return { price: p.price, compareAt: p.compareAt, rule: undefined };
  return { price: +best.toFixed(2), compareAt: Math.max(p.compareAt ?? 0, p.price), rule };
}

export type QuoteLine = ScopedItem & { productId: string; name: string; price: number; basePrice: number; qty: number; superPrice?: boolean; floor?: number };

export type Quote = {
  subtotal: number; // after automatic sale prices
  discounts: { name: string; code?: string; amount: number }[];
  discountTotal: number;
  delivery: number;
  total: number;
  couponError?: string;
  gifts: { tier: GiftTier; unlocked: boolean; remaining: number }[];
};

/** Cart maths shared by the cart, checkout and the server (which always recomputes). */
export function quote(lines: QuoteLine[], promos: Promotions, settings: Settings, opts: { code?: string; zone?: string; now?: number } = {}): Quote {
  const now = opts.now ?? Date.now();
  const subtotal = +lines.reduce((s, l) => s + l.price * l.qty, 0).toFixed(2);
  const discounts: Quote["discounts"] = [];

  // Automatic cart-level discounts (with a minimum spend) and an optional coupon.
  const cartRules = promos.discounts.filter((d) => isLive(d, now) && !d.code && d.minSubtotal > 0);
  let couponError: string | undefined;
  const code = opts.code?.trim().toLowerCase();
  if (code) {
    const c = promos.discounts.find((d) => d.code && d.code.toLowerCase() === code);
    if (!c || !isLive(c, now)) couponError = "This code isn't valid";
    else if (c.usageLimit > 0 && c.used >= c.usageLimit) couponError = "This code has been fully used";
    else if (subtotal < c.minSubtotal) couponError = `Spend at least $${c.minSubtotal} to use this code`;
    else cartRules.push(c);
  }
  // What each line has already been given by earlier rules, so rules together never go under the floor.
  const given = new Map<QuoteLine, number>();
  for (const d of cartRules) {
    // Coupons that don't stack skip items already on automatic sale.
    // SuperPrice items never take a coupon on top (the price is already at its floor or below the competition).
    const eligible = lines.filter((l) => !l.superPrice && inScope(l, d.scope) && !excluded(l, d.exclude) && (d.stack || l.price >= l.basePrice));
    // A minimum spend counts the items the rule is about ("spend $50 on Vichy"), not the whole bag.
    const scoped = d.scope.kind === "all" ? subtotal : lines.filter((l) => inScope(l, d.scope) && !excluded(l, d.exclude)).reduce((s, l) => s + l.price * l.qty, 0);
    if (d.minSubtotal > 0 && scoped < d.minSubtotal) {
      if (d.code) couponError = `Spend at least $${d.minSubtotal}${d.scope.kind === "all" ? "" : " on the items this code covers"} to use this code`;
      continue;
    }
    if (!eligible.length) {
      if (d.code) couponError = "This code doesn't apply to the items in your cart";
      continue;
    }
    // Each item's share stops at its minimum-margin price (Admin → Margins), counting earlier rules.
    const amount = eligible.reduce((s, l) => {
      const off = d.type === "percent" ? (l.price * d.value) / 100 : Math.min(l.price, d.value);
      const room = Math.max(0, (l.floor !== undefined ? l.price - l.floor : l.price) - (given.get(l) ?? 0));
      const take = Math.min(off, room);
      given.set(l, (given.get(l) ?? 0) + take);
      return s + take * l.qty;
    }, 0);
    if (amount > 0) discounts.push({ name: d.name, code: d.code || undefined, amount: +amount.toFixed(2) });
  }
  const discountTotal = +Math.min(subtotal, discounts.reduce((s, d) => s + d.amount, 0)).toFixed(2);
  const after = subtotal - discountTotal;
  const delivery = deliveryFor(settings, after, opts.zone);

  const gifts = promos.gifts.filter((g) => isLive(g, now)).sort((a, b) => a.minSubtotal - b.minSubtotal).map((tier) => {
    const spend = lines.filter((l) => inScope(l, tier.scope)).reduce((s, l) => s + l.price * l.qty, 0);
    return { tier, unlocked: spend >= tier.minSubtotal && spend > 0, remaining: +Math.max(0, tier.minSubtotal - spend).toFixed(2) };
  });

  return { subtotal, discounts, discountTotal, delivery, total: +(after + delivery).toFixed(2), couponError, gifts };
}

// ── Collections (curated product groups, e.g. imported from Skin Society's menus) ──

export type Collection = {
  key: string; // URL key: /collections/<key>/
  title: string;
  description: string;
  image: string;
  rule: string; // optional search words: matching products are included too
  brands: string[]; // optional: include every product of these brands
  hidden: boolean;
};
export type Collections = { items: Collection[] };
export const defaultCollections: Collections = { items: [] };
export const collectionsSchema = z.object({
  items: z.array(z.object({
    key: z.string().min(1).max(200).regex(/^[A-Za-z0-9/_-]+$/), title: z.string().min(1).max(120), description: z.string().max(2000),
    image: z.string().max(500), rule: z.string().max(200), brands: z.array(z.string().max(80)).max(50), hidden: z.boolean(),
  })).max(3000),
});
