import { z } from "zod";

// Ad platforms, tracking tags, product feeds and campaign records (Admin → Marketing → Campaigns & ads).
// Pixel and tag IDs are public (they sit in every page); access tokens stay on the server and are
// never sent back to the browser, not even to the admin page (it only sees whether one is set).

export const CHANNELS = {
  google: "Google Ads (Search, Shopping, Performance Max, YouTube)",
  meta: "Meta (Instagram & Facebook)",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  whatsapp: "WhatsApp broadcast",
  email: "Email newsletter",
  influencer: "Influencer / creator",
  sms: "SMS",
  offline: "Offline (pop-up, flyer, QR)",
  other: "Other",
} as const;
export type Channel = keyof typeof CHANNELS;

/** The UTM source and medium each channel's links get by default. */
export const CHANNEL_UTM: Record<Channel, { source: string; medium: string }> = {
  google: { source: "google", medium: "cpc" },
  meta: { source: "instagram", medium: "paid_social" },
  tiktok: { source: "tiktok", medium: "paid_social" },
  snapchat: { source: "snapchat", medium: "paid_social" },
  whatsapp: { source: "whatsapp", medium: "broadcast" },
  email: { source: "newsletter", medium: "email" },
  influencer: { source: "influencer", medium: "social" },
  sms: { source: "sms", medium: "sms" },
  offline: { source: "qr", medium: "offline" },
  other: { source: "other", medium: "referral" },
};

/** Where each platform's own campaign manager lives (campaigns are built and paid for there). */
export const PLATFORM_LINKS: Partial<Record<Channel, { manager: string; setup: string }>> = {
  google: { manager: "https://ads.google.com/aw/campaigns", setup: "https://ads.google.com/aw/conversions" },
  meta: { manager: "https://adsmanager.facebook.com/adsmanager/manage/campaigns", setup: "https://business.facebook.com/events_manager2" },
  tiktok: { manager: "https://ads.tiktok.com/i18n/perf/campaign", setup: "https://ads.tiktok.com/i18n/events_manager" },
  snapchat: { manager: "https://ads.snapchat.com/", setup: "https://business.snapchat.com/" },
};

export type Campaign = {
  id: string;
  name: string;
  channel: Channel;
  objective: "sales" | "traffic" | "awareness" | "leads" | "app";
  status: "draft" | "live" | "paused" | "ended";
  start: string; // YYYY-MM-DD
  end: string;
  budget: number; // planned, USD
  spend: number; // spent so far, USD (typed in from the platform)
  landing: string; // path on the shop, e.g. /collections/make-up/
  slug: string; // utm_campaign
  content: string; // utm_content (ad or creative name)
  coupon: string; // a discount code that also counts toward this campaign
  notes: string;
};

export type Marketing = {
  tracking: {
    ga4: string; // G-XXXXXXX
    googleAds: string; // AW-XXXXXXXXX
    googleAdsPurchaseLabel: string; // conversion label for purchases
    merchantCenter: string; // Merchant Center account ID (for reference)
    metaPixel: string;
    metaToken: string; // Conversions API access token (secret)
    metaTestCode: string; // Events Manager test code, while testing
    tiktokPixel: string;
    tiktokToken: string; // Events API access token (secret)
    snapPixel: string;
    gsc: string; // Google Search Console verification code
    metaDomain: string; // Meta domain verification code
  };
  campaigns: Campaign[];
};

export const SECRET_KEYS = ["metaToken", "tiktokToken"] as const;
export const MASK = "••••••••";

export const defaultMarketing: Marketing = {
  tracking: { ga4: "", googleAds: "", googleAdsPurchaseLabel: "", merchantCenter: "", metaPixel: "", metaToken: "", metaTestCode: "", tiktokPixel: "", tiktokToken: "", snapPixel: "", gsc: "", metaDomain: "" },
  campaigns: [],
};

export function withMarketingDefaults(v: Partial<Marketing> | null | undefined): Marketing {
  return { tracking: { ...defaultMarketing.tracking, ...(v?.tracking ?? {}) }, campaigns: (v?.campaigns ?? []).map((c) => ({ ...blankCampaign(), ...c })) };
}

export const slugifyCampaign = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);

export function blankCampaign(): Campaign {
  const today = new Date().toISOString().slice(0, 10);
  return { id: "", name: "", channel: "meta", objective: "sales", status: "draft", start: today, end: "", budget: 0, spend: 0, landing: "/", slug: "", content: "", coupon: "", notes: "" };
}

/** The tracked link to put in the ad: the landing page plus UTM tags. */
export function trackedLink(base: string, c: Pick<Campaign, "channel" | "landing" | "slug" | "content" | "name">): string {
  const u = new URL(c.landing || "/", base);
  const utm = CHANNEL_UTM[c.channel];
  u.searchParams.set("utm_source", utm.source);
  u.searchParams.set("utm_medium", utm.medium);
  u.searchParams.set("utm_campaign", c.slug || slugifyCampaign(c.name) || "campaign");
  if (c.content) u.searchParams.set("utm_content", slugifyCampaign(c.content));
  return u.toString();
}

const id = (re: RegExp) => z.string().trim().max(60).refine((v) => !v || re.test(v), "doesn't look right");
const str = (n: number) => z.string().trim().max(n);
export const marketingSchema = z.object({
  tracking: z.object({
    ga4: id(/^G-[A-Z0-9]{4,}$/i),
    googleAds: id(/^AW-\d{6,}$/i),
    googleAdsPurchaseLabel: id(/^[A-Za-z0-9_-]{4,60}$/),
    merchantCenter: str(30),
    metaPixel: id(/^\d{8,20}$/),
    metaToken: str(400),
    metaTestCode: str(30),
    tiktokPixel: id(/^[A-Z0-9]{10,30}$/i),
    tiktokToken: str(400),
    snapPixel: id(/^[a-f0-9-]{20,40}$/i),
    gsc: str(120),
    metaDomain: str(120),
  }),
  campaigns: z.array(z.object({
    id: str(40), name: str(120).min(1), channel: z.enum(Object.keys(CHANNELS) as [Channel, ...Channel[]]),
    objective: z.enum(["sales", "traffic", "awareness", "leads", "app"]), status: z.enum(["draft", "live", "paused", "ended"]),
    start: str(10), end: str(10), budget: z.coerce.number().min(0).max(1e7), spend: z.coerce.number().min(0).max(1e7),
    landing: str(300), slug: str(60), content: str(80), coupon: str(40), notes: str(2000),
  })).max(500),
});

/** First-touch / last-touch marketing data saved with an order. */
export type Attribution = { source?: string; medium?: string; campaign?: string; content?: string; term?: string; gclid?: string; fbclid?: string; ttclid?: string; landing?: string; referrer?: string; at?: string };
export const attributionSchema = z.object({
  source: str(80), medium: str(80), campaign: str(80), content: str(80), term: str(80),
  gclid: str(200), fbclid: str(300), ttclid: str(200), landing: str(300), referrer: str(300), at: str(40),
}).partial();

/** The pixel/tag IDs the shop pages need (no secrets). */
export const publicTracking = (m: Marketing) => ({
  ga4: m.tracking.ga4, googleAds: m.tracking.googleAds, googleAdsPurchaseLabel: m.tracking.googleAdsPurchaseLabel,
  metaPixel: m.tracking.metaPixel, tiktokPixel: m.tracking.tiktokPixel, snapPixel: m.tracking.snapPixel,
});
export type PublicTracking = ReturnType<typeof publicTracking>;
