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
  subscribe: { enabled: boolean; monthly: number; quarterly: number; collection: string; note: string; unlockMonthly: number; unlockQuarterly: number; maxRebate: number; cooldownDays: number; promo?: { enabled: boolean; endsAt: string; firstPct?: number; freeDelivery?: boolean } }; // Subscribe & save: earned after N delivered orders
  shadeFinder: { enabled: boolean };
  images: { frame: "white" | "grey"; padding: number }; // uniform product photos
  motion: boolean; // site animations
  trust: { lines: string[]; returnsSummary: string };
  game: Game;
  priceMatch: PriceMatch;
  prime: Prime;
};

/** Gamification (Admin › Gamification). Points-only rewards; every-spin-wins wheel lives in popup. */
export type Game = {
  enabled: boolean;
  celebrate: boolean; // confetti and haptics on reached goals
  badges: { enabled: boolean; points: Record<BadgeId, number> };
  ladder: { enabled: boolean; doublePointsAt: number }; // spend at which an order earns double Club points (0 = off)
  streak: { enabled: boolean; every: number; points: number }; // every Nth on-time subscription delivery earns bonus points
  checkin: { enabled: boolean; days: number; points: number; tips: string[] }; // app daily tip: a full streak earns points
  quest: { enabled: boolean; reviews: number; points: number }; // review N products you bought
  race: { enabled: boolean; steps: { friends: number; points: number }[] }; // referral milestones
};
export type BadgeId = "firstOrder" | "scan" | "routine" | "review" | "photoReview" | "referral" | "subscriber" | "gold";
export const BADGES: { id: BadgeId; name: string; text: string; icon: string }[] = [
  { id: "firstOrder", name: "First order", text: "Placed your first SuperYou order", icon: "bag" },
  { id: "scan", name: "Skin scanned", text: "Took a SuperScan 3D skin scan", icon: "scan" },
  { id: "routine", name: "Routine builder", text: "Bought 3 or more steps of a routine in one order", icon: "layers" },
  { id: "review", name: "Reviewer", text: "Wrote your first review", icon: "star" },
  { id: "photoReview", name: "Show & tell", text: "Added a photo to a review", icon: "camera" },
  { id: "referral", name: "Friend finder", text: "A friend ordered with your link", icon: "gift" },
  { id: "subscriber", name: "Never run out", text: "Started a Subscribe & save plan", icon: "repeat" },
  { id: "gold", name: "Gold member", text: "Reached Gold tier or above", icon: "crown" },
];
// Pharmacist tips shown one a day on the app home (editable in Admin › Growth › Gamification).
export const DEFAULT_TIPS = [
  "Apply sunscreen as the last step of your morning routine, and reapply every 2 hours outdoors.",
  "Use about two finger-lengths of sunscreen for the face and neck.",
  "Introduce one new active (retinol, acids, vitamin C) at a time, two weeks apart.",
  "Retinol goes on at night, on dry skin. Start 2–3 nights a week.",
  "Vitamin C in the morning, under sunscreen, boosts protection against pollution.",
  "Double cleanse at night if you wear sunscreen or make-up: oil or balm first, then a gentle cleanser.",
  "Apply serums on slightly damp skin, then seal with a moisturiser.",
  "Oily skin still needs moisturiser: choose a light gel labelled non-comedogenic.",
  "Change your pillowcase twice a week if you're prone to breakouts.",
  "Don't mix strong acids and retinol on the same night unless a pharmacist advises it.",
  "Patch-test new products behind the ear or on the inner arm for 48 hours.",
  "Lips need SPF too: use a lip balm with SPF 30 or more.",
  "Niacinamide calms redness and helps oily skin; it pairs well with most products.",
  "Hyaluronic acid draws water into the skin; follow it with a cream to keep it there.",
  "Pregnant or breastfeeding? Ask a pharmacist before using retinoids or high-dose acids.",
  "Wash make-up brushes weekly with mild shampoo to keep bacteria away.",
  "Exfoliate 1–3 times a week, not every day.",
  "Sunscreen expires: check the date and replace opened bottles after 12 months.",
  "For dandruff, leave the medicated shampoo on the scalp for 3–5 minutes before rinsing.",
  "Drink water, but skin hydration comes mostly from what you put on it: use a good moisturiser.",
  "Under-eye skin is thin: tap eye cream on with your ring finger.",
  "Supplements are not a substitute for a varied diet. Ask a pharmacist before combining several.",
  "Keep vitamin C serums in a cool, dark place: they lose strength in heat and light.",
  "Shave with the grain and use a clean blade to avoid ingrown hairs.",
  "Kids' sunscreen: choose mineral filters (zinc oxide, titanium dioxide) for sensitive skin.",
  "Dry hands in winter? Apply hand cream after every wash, and wear gloves outdoors.",
  "Acne patches work best on spots that have come to a head.",
  "Store perfume away from sunlight and heat to keep it smelling true.",
  "Fragrance-free is gentler for sensitive and eczema-prone skin.",
  "Not sure what your skin needs? Take a free SuperScan in the app.",
];

// SuperPrime: a monthly membership. Free delivery on every order (from freeMin), no daily limit on
// SuperPrice orders. Free for trialMonths with a first order of at least trialMinOrder. Paid with an
// order (cash on delivery works): each payment covers 30 days, renewed at checkout, never charged by itself.
export type Prime = { enabled: boolean; name: string; monthlyPrice: number; trialMonths: number; trialMinOrder: number; freeMin: number; unlimitedSuperPrice: boolean;
  /** Campaign: the free trial for everyone, with no minimum order, until endsAt ("" = until switched off). */
  promo: { enabled: boolean; endsAt: string } };
export const defaultPrime: Prime = { enabled: true, name: "SuperPrime", monthlyPrice: 3.99, trialMonths: 3, trialMinOrder: 100, freeMin: 10, unlimitedSuperPrice: true, promo: { enabled: false, endsAt: "" } };
/** Is the free-trial campaign running now (no minimum order)? */
export const primePromoLive = (p: Prime, now = Date.now()) => !!p.promo?.enabled && (!p.promo.endsAt || Date.parse(p.promo.endsAt) > now);

// Price guarantee: competitor shops checked nightly; when one sells the same item for less,
// SuperYou matches it, never below cost + marginPct. Server-only (not in publicGrowth).
export type PriceMatchSite = { domain: string; label: string; enabled: boolean; showName: boolean };
export type PriceMatch = {
  enabled: boolean;
  marginPct: number; // never below cost + this %
  badge: boolean;
  beatPct: number; // sell this % below the cheapest competitor (0 = match)
  directoryV?: number; // 1 once the retailer-directory shops and the 2% beat were applied
  tieBeatPct: number; // a shop sells it at our price: go this % below them
  assumeMarginPct: number; // no cost on file: assume our price carries this margin (0 = never match those)
  maxOffPct: number; // never more than this % below our own price
  maxUnits: number; // SuperPrice units per item per order
  oncePerDay: boolean; // one SuperPrice order per phone number per day
  skipOwnSource: boolean; // never compare a product with the shop we buy it from
  sites: PriceMatchSite[];
};
export const defaultPriceMatch: PriceMatch = {
  enabled: true,
  marginPct: 10,
  badge: true,
  beatPct: 2,
  tieBeatPct: 2,
  assumeMarginPct: 30,
  maxOffPct: 25,
  maxUnits: 2,
  oncePerDay: true,
  skipOwnSource: true,
  sites: [
    { domain: "feel22.com", label: "Feel22", enabled: true, showName: true },
    { domain: "neovitale.com", label: "NeoVitale", enabled: true, showName: true },
    { domain: "skinsociety.me", label: "Skin Society", enabled: true, showName: true },
    { domain: "nexuscare.me", label: "NexusCare", enabled: true, showName: true },
  ],
};

/** Lebanese beauty shops from the retailer directory (Nov 2026); added once to the price check, then editable in admin. */
export const DIRECTORY_SITES: PriceMatchSite[] = [
  { domain: "drugstoreonline.me", label: "Drugstore Online", enabled: true, showName: true },
  { domain: "hbytala.com", label: "H by Tala", enabled: true, showName: true },
  { domain: "by-sara.com", label: "By Sara", enabled: true, showName: true },
  { domain: "ahramcare.com", label: "Ahram Care", enabled: true, showName: true },
  { domain: "filiforme.me", label: "Filiforme", enabled: true, showName: true },
  { domain: "dalibeauty.co", label: "Dali Beauty", enabled: true, showName: true },
  { domain: "sohaticare.com", label: "Sohati Care", enabled: true, showName: true },
  { domain: "parapharm.com.lb", label: "Parapharm", enabled: true, showName: true },
  { domain: "phreya.com", label: "Phreya", enabled: true, showName: true },
  { domain: "kencosmetics.com", label: "KenCosmetics", enabled: true, showName: true },
  { domain: "kokare.com", label: "KOKARE", enabled: true, showName: true },
  { domain: "skinify.me", label: "Skinify", enabled: true, showName: true },
  { domain: "officialsolveskin.com", label: "Solveskin", enabled: true, showName: true },
  { domain: "articleprive.com", label: "Article Privé", enabled: true, showName: true },
  { domain: "germanyexpres.com", label: "Germany Express", enabled: true, showName: true },
  { domain: "beautypharm.com", label: "Beauty Pharm", enabled: true, showName: true },
  { domain: "beautyboxlb.com", label: "Beauty Box", enabled: true, showName: true },
  { domain: "facefactslb.com", label: "Face Facts", enabled: true, showName: true },
  { domain: "flormarlebanon.com", label: "Flormar Lebanon", enabled: true, showName: true },
  { domain: "shinyskinoo.com", label: "Shinyskinoo", enabled: true, showName: true },
  { domain: "samerkhouzami.com", label: "Samer Khouzami", enabled: true, showName: true },
  { domain: "bassamfattouh.com", label: "Bassam Fattouh", enabled: true, showName: true },
  { domain: "samoacosmetics.com", label: "SAMOA Cosmetics", enabled: true, showName: true },
  { domain: "faceofdee.com", label: "Face of Dee", enabled: true, showName: true },
  { domain: "theglamedition.com", label: "The Glam Edition", enabled: true, showName: true },
  { domain: "shamsinebeauty.com", label: "Shamsine Beauty", enabled: true, showName: true },
  { domain: "beautyeuphorialb.com", label: "Beauty Euphoria", enabled: true, showName: true },
  { domain: "beauty4me.shop", label: "Beauty 4 Me", enabled: true, showName: true },
  { domain: "thebeautyspotlb.com", label: "The Beauty Spot", enabled: true, showName: true },
  { domain: "rolandekassis.com", label: "Rolande Kassis", enabled: true, showName: true },
  { domain: "shadesbeauty.shop", label: "Shades Beauty", enabled: true, showName: true },
  { domain: "koreancosmeticsww.com", label: "Korean Cosmetics Worldwide", enabled: true, showName: true },
  { domain: "duft-lb.com", label: "Duft", enabled: true, showName: true },
  { domain: "thebodyshop.com.lb", label: "The Body Shop Lebanon", enabled: true, showName: true },
  { domain: "lushlebanon.com", label: "Lush Lebanon", enabled: true, showName: true },
  { domain: "array-lb.com", label: "Array Health & Beauty", enabled: true, showName: true },
  { domain: "buyitlb.com", label: "Buy It Online", enabled: true, showName: true },
  { domain: "glow55.com", label: "Glow55", enabled: true, showName: true },
  { domain: "shopandbeyondlb.com", label: "Shop and Beyond", enabled: true, showName: true },
  { domain: "360cosmedics.com", label: "360 Cosmedics", enabled: true, showName: true },
  { domain: "skintoc.com", label: "SKINTOC", enabled: true, showName: true },
  { domain: "taminaonline.com", label: "Tamina Online", enabled: true, showName: true },
  { domain: "faceshine.me", label: "Faceshine", enabled: true, showName: true },
  { domain: "atelierbeautanique.com", label: "Atelier Beautanique", enabled: true, showName: true },
  { domain: "lorekacare.com", label: "Loréka Care", enabled: true, showName: true },
];

export const defaultGame: Game = {
  enabled: true,
  celebrate: true,
  badges: { enabled: true, points: { firstOrder: 50, scan: 25, routine: 50, review: 25, photoReview: 50, referral: 100, subscriber: 50, gold: 100 } },
  ladder: { enabled: true, doublePointsAt: 90 },
  streak: { enabled: true, every: 3, points: 100 },
  checkin: { enabled: true, days: 7, points: 20, tips: DEFAULT_TIPS },
  quest: { enabled: true, reviews: 3, points: 75 },
  race: { enabled: true, steps: [{ friends: 3, points: 150 }, { friends: 5, points: 300 }, { friends: 10, points: 750 }] },
};

export const defaultGrowth: Growth = {
  popup: {
    enabled: true,
    mode: "wheel",
    percent: 10,
    // Odds (weight = % chance): 5% off 50, 10% off 35, 15% off 10, 20% off 5. One code per phone number.
    wheel: [
      { label: "5% off", percent: 5, weight: 50 },
      { label: "20% off", percent: 20, weight: 5 },
      { label: "10% off", percent: 10, weight: 35 },
      { label: "15% off", percent: 15, weight: 10 },
    ],
    title: "Spin to win up to 20% off your first order",
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
  subscribe: { enabled: true, monthly: 10, quarterly: 15, collection: "", note: "Skip, change or cancel any time. Pay on delivery, nothing charged in advance.", unlockMonthly: 3, unlockQuarterly: 2, maxRebate: 15, cooldownDays: 90, promo: { enabled: true, endsAt: "", firstPct: 5, freeDelivery: true } },
  skinScan: { enabled: true, intro: "SuperScan is our free 3D AI skin scan, like setting up Face ID: look at the screen, slowly turn your head in a circle, and the AI reads your skin from five angles: front, both sides, chin up and chin down. You get your skin type, a zone-by-zone reading and a routine from products in stock. Photos are analysed once and never stored." },
  shadeFinder: { enabled: true },
  images: { frame: "grey", padding: 8 },
  motion: true,
  game: defaultGame,
  priceMatch: defaultPriceMatch,
  prime: defaultPrime,
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
  subscribe: z.object({ enabled: z.boolean(), monthly: z.number().min(0).max(50), quarterly: z.number().min(0).max(50), collection: z.string().max(200), note: z.string().max(200), unlockMonthly: z.number().int().min(1).max(12).default(3), unlockQuarterly: z.number().int().min(1).max(12).default(2), maxRebate: z.number().min(0).max(500).default(15), cooldownDays: z.number().int().min(0).max(365).default(90), promo: z.object({ enabled: z.boolean(), endsAt: z.string().max(10), firstPct: z.number().min(0).max(50).default(5), freeDelivery: z.boolean().default(true) }).default({ enabled: false, endsAt: "", firstPct: 5, freeDelivery: true }) }).default({ enabled: true, monthly: 10, quarterly: 15, collection: "", note: "", unlockMonthly: 3, unlockQuarterly: 2, maxRebate: 15, cooldownDays: 90, promo: { enabled: true, endsAt: "", firstPct: 5, freeDelivery: true } }),
  shadeFinder: z.object({ enabled: z.boolean() }),
  images: z.object({ frame: z.enum(["white", "grey"]), padding: z.number().min(0).max(20) }),
  motion: z.boolean(),
  trust: z.object({ lines: z.array(z.string().max(160)).max(6), returnsSummary: z.string().max(400) }),
  game: z.object({
    enabled: z.boolean(), celebrate: z.boolean(),
    badges: z.object({ enabled: z.boolean(), points: z.record(z.string(), z.number().int().min(0).max(10000)) }),
    ladder: z.object({ enabled: z.boolean(), doublePointsAt: z.number().min(0).max(10000) }),
    streak: z.object({ enabled: z.boolean(), every: z.number().int().min(2).max(24), points: z.number().int().min(0).max(10000) }),
    checkin: z.object({ enabled: z.boolean(), days: z.number().int().min(2).max(60), points: z.number().int().min(0).max(1000), tips: z.array(z.string().max(300)).max(400).transform((a) => a.map((x) => x.trim()).filter(Boolean)).optional().default(DEFAULT_TIPS) }),
    quest: z.object({ enabled: z.boolean(), reviews: z.number().int().min(1).max(20), points: z.number().int().min(0).max(10000) }),
    race: z.object({ enabled: z.boolean(), steps: z.array(z.object({ friends: z.number().int().min(1).max(1000), points: z.number().int().min(0).max(100000) })).max(6) }),
  }).transform((g) => g as Game).default(defaultGame),
  prime: z.object({
    enabled: z.boolean(), name: z.string().trim().min(1).max(30), monthlyPrice: z.number().min(0).max(100), trialMonths: z.number().int().min(0).max(12),
    trialMinOrder: z.number().min(0).max(10000), freeMin: z.number().min(0).max(1000), unlimitedSuperPrice: z.boolean(),
    promo: z.object({ enabled: z.boolean(), endsAt: z.string().max(40) }).default({ enabled: false, endsAt: "" }),
  }).default(defaultPrime),
  priceMatch: z.object({
    enabled: z.boolean(), marginPct: z.number().min(0).max(100), badge: z.boolean(),
    beatPct: z.number().min(0).max(30).default(2), tieBeatPct: z.number().min(0).max(30).default(2), directoryV: z.number().optional(), assumeMarginPct: z.number().min(0).max(80).default(30), maxOffPct: z.number().min(1).max(60).default(25),
    maxUnits: z.number().int().min(1).max(20).default(2), oncePerDay: z.boolean().default(true), skipOwnSource: z.boolean().default(true),
    sites: z.preprocess((a) => (Array.isArray(a) ? a.filter((x) => x && String(x.domain ?? "").trim()) : a), z.array(z.object({ domain: z.string().trim().toLowerCase().min(3).max(100).regex(/^[a-z0-9.-]+\.[a-z]{2,}$/), label: z.string().trim().min(1).max(40), enabled: z.boolean(), showName: z.boolean() })).max(150)),
  }).default(defaultPriceMatch),
});

export function withGrowthDefaults(v: Partial<Growth> | null | undefined): Growth {
  const d = defaultGrowth;
  if (!v) return d;
  return {
    ...d, ...v,
    popup: { ...d.popup, ...v.popup }, samples: { ...d.samples, ...v.samples }, dedupe: { ...d.dedupe, ...v.dedupe },
    reviews: { ...d.reviews, ...v.reviews }, club: { ...d.club, ...v.club, bonus: { ...d.club.bonus, ...v.club?.bonus }, referral: { ...d.club.referral, ...v.club?.referral }, memberPrice: { ...d.club.memberPrice, ...v.club?.memberPrice } }, pharmacist: { ...d.pharmacist, ...v.pharmacist },
    bundles: { ...d.bundles, ...v.bundles }, reorder: { ...d.reorder, ...v.reorder }, advent: { ...d.advent, ...v.advent },
    skinScan: { ...d.skinScan, ...v.skinScan }, subscribe: { ...d.subscribe, ...v.subscribe, promo: { ...d.subscribe.promo!, ...v.subscribe?.promo } }, shadeFinder: { ...d.shadeFinder, ...v.shadeFinder }, images: { ...d.images, ...v.images }, trust: { ...d.trust, ...v.trust },
    prime: { ...defaultPrime, ...v.prime, promo: { ...defaultPrime.promo, ...v.prime?.promo } },
    priceMatch: withDirectory({ ...defaultPriceMatch, ...v.priceMatch, sites: v.priceMatch?.sites ?? defaultPriceMatch.sites }),
    game: { ...defaultGame, ...v.game, badges: { ...defaultGame.badges, ...v.game?.badges, points: { ...defaultGame.badges.points, ...v.game?.badges?.points } }, ladder: { ...defaultGame.ladder, ...v.game?.ladder }, streak: { ...defaultGame.streak, ...v.game?.streak }, checkin: { ...defaultGame.checkin, ...v.game?.checkin }, quest: { ...defaultGame.quest, ...v.game?.quest }, race: { ...defaultGame.race, ...v.game?.race } },
  };
}

/** "Subscribe now: the discount starts from your 2nd order" campaign. */
export const subPromoLive = (g: Pick<Growth, "subscribe">) => !!g.subscribe.promo?.enabled && (!g.subscribe.promo.endsAt || g.subscribe.promo.endsAt >= new Date().toISOString().slice(0, 10));

/** One-time: add the directory shops and go 2% below a cheaper shop (owner's rule, Nov 2026). */
function withDirectory(pm: PriceMatch): PriceMatch {
  if (pm.directoryV === 1) return pm;
  const have = new Set(pm.sites.map((s) => s.domain.toLowerCase()));
  return { ...pm, beatPct: 2, directoryV: 1, sites: [...pm.sites, ...DIRECTORY_SITES.filter((s) => !have.has(s.domain))] };
}

/** What the browser needs (no voucher logic, no wheel odds). */
export function publicGrowth(g: Growth, aiKey?: boolean) {
  const { wheel, ...popup } = g.popup;
  return {
    popup: { ...popup, wheel: wheel.map((w) => w.label) },
    freeDeliveryBar: g.freeDeliveryBar,
    superPrice: g.priceMatch.enabled && g.priceMatch.badge,
    // Shop names checked every night, for the "no cheaper price anywhere" card. Shops we buy from stay out.
    superPriceBeat: g.priceMatch.beatPct,
    superPriceShops: g.priceMatch.enabled ? [...new Set(g.priceMatch.sites.filter((s) => s.enabled && s.showName && s.domain !== "neovitale.com").map((s) => s.label))] : [],
    prime: { ...g.prime, promoLive: primePromoLive(g.prime) },
    reviews: { enabled: g.reviews.enabled, showOnCards: g.reviews.showOnCards },
    club: { enabled: g.club.enabled, name: g.club.name, pointsPerDollar: g.club.pointsPerDollar, rewardPoints: g.club.rewardPoints, rewardValue: g.club.rewardValue, tiers: g.club.tiers, bonus: g.club.bonus, referral: g.club.referral, expiryMonths: g.club.expiryMonths, memberPrice: g.club.memberPrice, birthdayPercent: g.club.birthdayPercent },
    pharmacist: g.pharmacist,
    bundles: g.bundles,
    advent: { enabled: g.advent.enabled },
    // Only offered to shoppers once the AI key is in place (otherwise the page just says "not connected").
    skinScan: { enabled: g.skinScan.enabled && (aiKey ?? (typeof process !== "undefined" && !!process.env.ANTHROPIC_API_KEY)) },
    subscribe: { ...g.subscribe, promoLive: subPromoLive(g) },
    shadeFinder: g.shadeFinder,
    images: g.images,
    trust: g.trust,
    game: g.game,
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
