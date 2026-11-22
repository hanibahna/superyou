// Growth features configured in Admin → Growth & loyalty: sign-up pop-up, free samples,
// duplicate merging, reviews, loyalty club, pharmacist chat, routine bundles, reorder
// reminders, advent calendar, skin scan, shade finder and image frames. Client-safe.

import { z } from "zod";

export type WheelSlice = { label: string; percent: number; weight: number };
export type AdventDoor = { day: number; title: string; text: string; code: string; href: string; image: string };
export type ClubTier = { name: string; minSpend: number; multiplier: number; perks: string };

export type Growth = {
  popup: {
    enabled: boolean;
    mode: "classic" | "wheel"; // wheel = spin-to-win
    percent: number; // classic offer
    wheel: WheelSlice[];
    title: string;
    text: string;
    image: string;
    delaySeconds: number;
    scrollPercent: number; // show when either happens first
    validDays: number; // personal code lifetime
    minSubtotal: number;
    tab: boolean; // permanent "Get 10% off" tab
    tabLabel: string;
    cartExit: boolean; // offer when leaving with items in the bag
    cartExitText: string;
    cartExitPercent: number;
  };
  samples: { enabled: boolean; title: string; pick: number; minSubtotal: number; skus: string[] };
  freeDeliveryBar: boolean;
  dedupe: { enabled: boolean; prefer: "cheapest" | "neovitale.com" | "skinsociety.me" };
  reviews: { enabled: boolean; autoApprove: boolean; askAfterDelivery: boolean; showOnCards: boolean };
  club: {
    enabled: boolean;
    name: string;
    pointsPerDollar: number;
    rewardPoints: number; // every N points…
    rewardValue: number; // …becomes a $X personal voucher
    tiers: ClubTier[];
    birthdayPercent: number; // 0 = off
    bonus: { join: number; firstOrder: number; review: number; photoReview: number }; // extra points
    referral: { enabled: boolean; friendAmount: number; friendMinSubtotal: number; referrerPoints: number };
    expiryMonths: number; // points expire after this long without an order (0 = never)
    memberPrice: { enabled: boolean; percent: number; collection: string }; // members-only % off a collection (empty = whole shop)
  };
  pharmacist: { enabled: boolean; label: string; whatsapp: string; hours: string };
  bundles: { enabled: boolean; minSteps: number; percent: number };
  reorder: { enabled: boolean; days: { category: string; days: number }[]; defaultDays: number };
  advent: { enabled: boolean; year: number; title: string; intro: string; doors: AdventDoor[] };
  skinScan: { enabled: boolean; intro: string };
  subscribe: { enabled: boolean; monthly: number; quarterly: number; collection: string; note: string }; // Subscribe & save
  shadeFinder: { enabled: boolean };
  images: { frame: "white" | "grey"; padding: number }; // uniform product photos
  motion: boolean; // site animations
  trust: { lines: string[]; returnsSummary: string };
};

export const defaultGrowth: Growth = {
  popup: {
    enabled: true,
    mode: "classic",
    percent: 10,
    wheel: [
      { label: "5% off", percent: 5, weight: 40 },
      { label: "10% off", percent: 10, weight: 35 },
      { label: "15% off", percent: 15, weight: 20 },
      { label: "20% off", percent: 20, weight: 5 },
    ],
    title: "Get 10% off your first order",
    text: "Join SuperYou for pharmacist tips, early access to sales and your welcome code.",
    image: "",
    delaySeconds: 8,
    scrollPercent: 40,
    validDays: 14,
    minSubtotal: 0,
    tab: true,
    tabLabel: "Get 10% off",
    cartExit: true,
    cartExitText: "Wait — finish your order with free delivery today.",
    cartExitPercent: 0,
  },
  samples: { enabled: true, title: "Choose 2 free samples", pick: 2, minSubtotal: 0, skus: [] },
  freeDeliveryBar: true,
  dedupe: { enabled: true, prefer: "cheapest" },
  reviews: { enabled: true, autoApprove: false, askAfterDelivery: true, showOnCards: true },
  club: {
    enabled: true,
    name: "SuperYou Club",
    pointsPerDollar: 1,
    rewardPoints: 200,
    rewardValue: 10,
    tiers: [
      { name: "Rose", minSpend: 0, multiplier: 1, perks: "1 point per $1 · birthday gift · member-only offers" },
      { name: "Gold", minSpend: 300, multiplier: 1.25, perks: "25% more points · early sale access · free skin consultation" },
      { name: "Noir", minSpend: 800, multiplier: 1.5, perks: "50% more points · VIP events · free delivery on every order" },
    ],
    birthdayPercent: 15,
    bonus: { join: 50, firstOrder: 100, review: 20, photoReview: 40 },
    referral: { enabled: true, friendAmount: 5, friendMinSubtotal: 25, referrerPoints: 150 },
    expiryMonths: 12,
    memberPrice: { enabled: false, percent: 5, collection: "" },
  },
  pharmacist: { enabled: true, label: "Ask a pharmacist", whatsapp: "", hours: "Mon–Sat, 9:00–20:00" },
  bundles: { enabled: true, minSteps: 3, percent: 10 },
  reorder: {
    enabled: true,
    defaultDays: 60,
    days: [
      { category: "supplements", days: 30 },
      { category: "skincare", days: 60 },
      { category: "hair", days: 60 },
      { category: "makeup", days: 90 },
    ],
  },
  advent: {
    enabled: true,
    year: 2026,
    title: "SuperYou beauty advent calendar",
    intro: "A new deal or gift behind every door, 1–24 December. Come back each day.",
    doors: Array.from({ length: 24 }, (_, i) => ({ day: i + 1, title: `Day ${i + 1}`, text: "", code: "", href: "/shop/?sale=1", image: "" })),
  },
  subscribe: { enabled: true, monthly: 10, quarterly: 15, collection: "", note: "Skip, change or cancel any time. Pay on delivery, nothing charged in advance." },
  skinScan: { enabled: true, intro: "SuperScan is our free 3D AI skin scan, like setting up Face ID: look at the screen, slowly turn your head in a circle, and the AI reads your skin from the front and both sides. You get your skin type, a zone-by-zone reading and a routine from products in stock. Photos are analysed once and never stored." },
  shadeFinder: { enabled: true },
  images: { frame: "grey", padding: 8 },
  motion: true,
  trust: {
    lines: ["100% authentic — supplied by a licensed Lebanese pharmacy", "Advice from qualified pharmacists, free on WhatsApp", "Easy returns on unopened items within 7 days"],
    returnsSummary: "Unopened items can be returned within 7 days. Opened skincare can't be returned for hygiene reasons unless faulty.",
  },
};

const slice = z.object({ label: z.string().min(1).max(30), percent: z.number().min(1).max(90), weight: z.number().min(0).max(1000) });
export const growthSchema = z.object({
  popup: z.object({
    enabled: z.boolean(), mode: z.enum(["classic", "wheel"]), percent: z.number().min(1).max(90), wheel: z.array(slice).min(2).max(10),
    title: z.string().max(120), text: z.string().max(400), image: z.string().max(500), delaySeconds: z.number().min(0).max(300),
    scrollPercent: z.number().min(0).max(100), validDays: z.number().int().min(1).max(365), minSubtotal: z.number().min(0).max(10000),
    tab: z.boolean(), tabLabel: z.string().max(40), cartExit: z.boolean(), cartExitText: z.string().max(200), cartExitPercent: z.number().min(0).max(90),
  }),
  samples: z.object({ enabled: z.boolean(), title: z.string().max(80), pick: z.number().int().min(1).max(6), minSubtotal: z.number().min(0).max(10000), skus: z.array(z.string().max(100)).max(40) }),
  freeDeliveryBar: z.boolean(),
  dedupe: z.object({ enabled: z.boolean(), prefer: z.enum(["cheapest", "neovitale.com", "skinsociety.me"]) }),
  reviews: z.object({ enabled: z.boolean(), autoApprove: z.boolean(), askAfterDelivery: z.boolean(), showOnCards: z.boolean() }),
  club: z.object({
    enabled: z.boolean(), name: z.string().max(60), pointsPerDollar: z.number().min(0).max(100), rewardPoints: z.number().int().min(1).max(1000000),
    rewardValue: z.number().min(0).max(10000), birthdayPercent: z.number().min(0).max(90),
    bonus: z.object({ join: z.number().int().min(0).max(100000), firstOrder: z.number().int().min(0).max(100000), review: z.number().int().min(0).max(100000), photoReview: z.number().int().min(0).max(100000) }),
    referral: z.object({ enabled: z.boolean(), friendAmount: z.number().min(0).max(1000), friendMinSubtotal: z.number().min(0).max(10000), referrerPoints: z.number().int().min(0).max(100000) }),
    expiryMonths: z.number().int().min(0).max(60),
    memberPrice: z.object({ enabled: z.boolean(), percent: z.number().min(0).max(90), collection: z.string().max(200) }),
    tiers: z.array(z.object({ name: z.string().min(1).max(30), minSpend: z.number().min(0), multiplier: z.number().min(0).max(10), perks: z.string().max(200) })).min(1).max(6),
  }),
  pharmacist: z.object({ enabled: z.boolean(), label: z.string().max(40), whatsapp: z.string().max(30), hours: z.string().max(80) }),
  bundles: z.object({ enabled: z.boolean(), minSteps: z.number().int().min(2).max(8), percent: z.number().min(1).max(90) }),
  reorder: z.object({ enabled: z.boolean(), defaultDays: z.number().int().min(7).max(365), days: z.array(z.object({ category: z.string().max(60), days: z.number().int().min(7).max(365) })).max(30) }),
  advent: z.object({
    enabled: z.boolean(), year: z.number().int().min(2025).max(2100), title: z.string().max(100), intro: z.string().max(300),
    doors: z.array(z.object({ day: z.number().int().min(1).max(31), title: z.string().max(80), text: z.string().max(300), code: z.string().max(40), href: z.string().max(300), image: z.string().max(500) })).max(31),
  }),
  skinScan: z.object({ enabled: z.boolean(), intro: z.string().max(400) }),
  subscribe: z.object({ enabled: z.boolean(), monthly: z.number().min(0).max(50), quarterly: z.number().min(0).max(50), collection: z.string().max(200), note: z.string().max(200) }).default({ enabled: true, monthly: 10, quarterly: 15, collection: "", note: "" }),
  shadeFinder: z.object({ enabled: z.boolean() }),
  images: z.object({ frame: z.enum(["white", "grey"]), padding: z.number().min(0).max(20) }),
  motion: z.boolean(),
  trust: z.object({ lines: z.array(z.string().max(160)).max(6), returnsSummary: z.string().max(400) }),
});

export function withGrowthDefaults(v: Partial<Growth> | null | undefined): Growth {
  const d = defaultGrowth;
  if (!v) return d;
  return {
    ...d, ...v,
    popup: { ...d.popup, ...v.popup }, samples: { ...d.samples, ...v.samples }, dedupe: { ...d.dedupe, ...v.dedupe },
    reviews: { ...d.reviews, ...v.reviews }, club: { ...d.club, ...v.club, bonus: { ...d.club.bonus, ...v.club?.bonus }, referral: { ...d.club.referral, ...v.club?.referral }, memberPrice: { ...d.club.memberPrice, ...v.club?.memberPrice } }, pharmacist: { ...d.pharmacist, ...v.pharmacist },
    bundles: { ...d.bundles, ...v.bundles }, reorder: { ...d.reorder, ...v.reorder }, advent: { ...d.advent, ...v.advent },
    skinScan: { ...d.skinScan, ...v.skinScan }, subscribe: { ...d.subscribe, ...v.subscribe }, shadeFinder: { ...d.shadeFinder, ...v.shadeFinder }, images: { ...d.images, ...v.images }, trust: { ...d.trust, ...v.trust },
  };
}

/** What the browser needs (no voucher logic, no wheel odds). */
export function publicGrowth(g: Growth, aiKey?: boolean) {
  const { wheel, ...popup } = g.popup;
  return {
    popup: { ...popup, wheel: wheel.map((w) => w.label) },
    freeDeliveryBar: g.freeDeliveryBar,
    reviews: { enabled: g.reviews.enabled, showOnCards: g.reviews.showOnCards },
    club: { enabled: g.club.enabled, name: g.club.name, pointsPerDollar: g.club.pointsPerDollar, rewardPoints: g.club.rewardPoints, rewardValue: g.club.rewardValue, tiers: g.club.tiers, bonus: g.club.bonus, referral: g.club.referral, expiryMonths: g.club.expiryMonths, memberPrice: g.club.memberPrice, birthdayPercent: g.club.birthdayPercent },
    pharmacist: g.pharmacist,
    bundles: g.bundles,
    advent: { enabled: g.advent.enabled },
    // Only offered to shoppers once the AI key is in place (otherwise the page just says "not connected").
    skinScan: { enabled: g.skinScan.enabled && (aiKey ?? (typeof process !== "undefined" && !!process.env.ANTHROPIC_API_KEY)) },
    subscribe: g.subscribe,
    shadeFinder: g.shadeFinder,
    images: g.images,
    trust: g.trust,
  };
}
export type PublicGrowth = ReturnType<typeof publicGrowth>;

// ── Duplicates across catalogs: same brand + same name words + same size ──

const STOP = new Set("the a de la le les et and with for of pack x".split(" "));
const words = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) ?? [];
function sizeOf(p: { name: string; variant?: string; size?: string }) {
  const m = `${p.variant ?? ""} ${p.size ?? ""} ${p.name}`.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(ml|gr|g|oz|caps|tabs|capsules|tablets|sachets)\b/);
  return m ? `${String(parseFloat(m[1].replace(",", ".")))}${m[2].slice(0, 2)}` : "";
}
/** Same brand + size and the same words, allowing small spelling differences ("Blonde/Blond", "Moisturizing/Moisturising"). */
export function nameTokens(p: { brand: string; name: string }) {
  const b = new Set(words(p.brand));
  return [...new Set(words(p.name).filter((x) => !b.has(x) && !STOP.has(x) && !/^\d+(ml|g)?$/.test(x)).map((x) => (x.length > 4 ? x.replace(/s$/, "") : x)))].sort();
}
export const bucketKey = (p: { brand: string; name: string; variant?: string; size?: string }) => `${words(p.brand).join("")}|${sizeOf(p)}`;
function lev(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}
export function sameNames(a: string[], b: string[]) {
  if (a.length !== b.length || a.length < 2) return a.length > 0 && a.join(" ") === b.join(" ");
  const rest = [...b];
  for (const x of a) {
    let bi = -1, best = 0;
    rest.forEach((y, i) => { const r = x === y ? 1 : Math.min(x.length, y.length) >= 5 ? 1 - lev(x, y) / Math.max(x.length, y.length) : 0; if (r > best) (best = r, (bi = i)); });
    if (best < 0.83) return false;
    rest.splice(bi, 1);
  }
  return true;
}

export function dupKey(p: { brand: string; name: string; variant?: string; size?: string }) {
  const b = new Set(words(p.brand));
  const w = [...new Set(words(p.name).filter((x) => !b.has(x) && !STOP.has(x) && !/^\d+(ml|g)?$/.test(x)))].sort();
  return `${words(p.brand).join("")}|${w.join(" ")}|${sizeOf(p)}`;
}

// ── Routine steps (used for bundles and "pairs well with") ──

type StepLike = { id: string; keywords: string[]; exclude: string[]; categories: string[] };
export function stepOf(p: { name: string; category: string }, steps: StepLike[]) {
  const n = p.name.toLowerCase();
  for (const s of steps) {
    if (s.categories.length && !s.categories.includes(p.category)) continue;
    if (s.exclude.some((x) => n.includes(x.toLowerCase()))) continue;
    if (s.keywords.some((x) => n.includes(x.toLowerCase()))) return s.id;
  }
  return null;
}

/** Club tier for a 12-month spend. */
export function tierFor(tiers: ClubTier[], spend: number) {
  const sorted = [...tiers].sort((a, b) => a.minSpend - b.minSpend);
  let t = sorted[0];
  for (const x of sorted) if (spend >= x.minSpend) t = x;
  const next = sorted.find((x) => x.minSpend > spend);
  return { tier: t, next, toNext: next ? +(next.minSpend - spend).toFixed(2) : 0 };
}

/** First number in "1–3 working days" → a delivery date (skips Sundays). */
export function deliveryBy(estimate: string, from = new Date()) {
  const nums = (estimate.match(/\d+/g) ?? []).map(Number);
  let days = nums.length ? Math.max(...nums) : 3;
  const d = new Date(from);
  while (days > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) days--;
  }
  return d;
}

export const waLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
