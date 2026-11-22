import "server-only";

import { z } from "zod";
import { db } from "@/lib/db";

// Admin → Sections & AI: the AI shopping advisor, YouTube videos on product pages, and the
// banner, tips and app shown at the top of each shop section. One document, keys stay on the server.

export type SectionContent = {
  enabled: boolean;
  banner: { title: string; text: string; cta: string; href: string; image: string; bg: string };
  tips: string[];
  app: { label: string; href: string };
};
export type Extras = {
  anthropicKey: string; // Claude API key (used when the ANTHROPIC_API_KEY setting is not in Vercel)
  advisor: { enabled: boolean; name: string; greeting: string; suggestions: string[]; perHour: number };
  youtube: { enabled: boolean; key: string; pins: Record<string, string> }; // pins: product slug → video id, or "none" to hide
  sections: Record<string, SectionContent>;
};

const art = (n: string) => `/brand/home/png/cat-${n}.png`;
const sec = (title: string, text: string, cta: string, href: string, image: string, bg: string, tips: string[], app: [string, string]): SectionContent =>
  ({ enabled: true, banner: { title, text, cta, href, image, bg }, tips, app: { label: app[0], href: app[1] } });

export const defaultExtras: Extras = {
  anthropicKey: "",
  advisor: {
    enabled: true,
    name: "SuperYou AI",
    greeting: "Hi! Tell me what you're looking for (your skin, hair, a gift, a budget) and I'll suggest products we have in stock.",
    suggestions: ["A simple routine for oily skin", "Sunscreen that won't break me out", "Gift for my mum under $50", "Something for dry, frizzy hair"],
    perHour: 40,
  },
  youtube: { enabled: true, key: "", pins: {} },
  sections: {
    _all: sec("Not sure what to choose?", "Ask our pharmacist on a free video call, or let our AI advisor suggest products for you.", "Book a free video call", "/services/?book=video-consult", "/brand/home/png/hero-pharmacist.png", "#ffd6e3",
      ["Every product we sell is original, from official distributors.", "Pay cash on delivery anywhere in Lebanon.", "Patch-test new skincare for 24 hours before full use.", "Not sure about an ingredient? Ask our pharmacist on WhatsApp."], ["Routine finder", "/routine/"]),
    skincare: sec("Your routine, in 60 seconds", "Answer a few questions and get a morning and night routine from products in stock.", "Find my routine", "/routine/", art("skincare"), "#ffd6e3",
      ["Cleanse, treat, moisturise, protect: four steps cover most skin.", "Introduce one new active at a time and give it 4 weeks.", "Patch-test new products behind the ear for 24 hours.", "Retinol at night, vitamin C in the morning, sunscreen always."], ["Skin scan", "/skin-scan/"]),
    suncare: sec("Sun protection, sorted", "Pick your skin and your day and we'll match the right SPF.", "Find my sunscreen", "/finder/sun/", art("sun"), "#fff3b8",
      ["Use about two finger-lengths of sunscreen for face and neck.", "Reapply every 2 hours outdoors, and after swimming.", "SPF 50 for Lebanese summers, beach days and after peels.", "Tinted mineral formulas also help with dark spots."], ["Sun finder", "/finder/sun/"]),
    makeup: sec("Never buy the wrong shade again", "Find your foundation and concealer shade across brands.", "Find my shade", "/shade-finder/", art("lips"), "#ffe1c7",
      ["Match foundation on your jawline, in daylight.", "Concealer one shade lighter brightens; same shade hides spots.", "Clean brushes weekly to avoid breakouts.", "Set only where you shine to keep skin looking fresh."], ["Make-up finder", "/finder/makeup/"]),
    hair: sec("Healthy hair starts at the scalp", "Tell us your hair type and worries and get a matched care set.", "Find my hair care", "/finder/hair/", art("hair"), "#e2dcff",
      ["Shampoo the scalp, condition the lengths.", "Use heat protection before every blow-dry or straightener.", "A weekly mask helps dry and coloured hair.", "Sudden hair fall is worth a chat with our pharmacist."], ["Hair finder", "/finder/hair/"]),
    body: sec("Soft skin, head to toe", "Body care for dry patches, rough skin and everyday glow.", "Find my body care", "/finder/body/", art("body"), "#cfeedd",
      ["Moisturise within 3 minutes of showering to lock in water.", "Urea and lactic acid smooth rough elbows and heels.", "Lukewarm showers dry the skin less than hot ones."], ["Body finder", "/finder/body/"]),
    fragrance: sec("Find a scent that feels like you", "Fresh, floral, sweet or woody: answer four questions.", "Find my scent", "/finder/fragrance/", art("fragrance"), "#ffd6e3",
      ["Spray on pulse points; don't rub your wrists together.", "Perfume lasts longer on moisturised skin.", "Test on skin and wait 20 minutes before deciding."], ["Scent finder", "/finder/fragrance/"]),
    nails: sec("Strong nails, lasting colour", "Care, colour and tools for at-home manicures.", "Shop nails", "/shop/?category=nails", art("nails"), "#ffe1c7",
      ["Base coat stops polish staining your nails.", "Cuticle oil every night keeps nails flexible.", "File in one direction to avoid splitting."], ["Make-up finder", "/finder/makeup/"]),
    men: sec("Simple care for men", "Cleanser, moisturiser, sunscreen: done in two minutes.", "Find my routine", "/routine/", art("face"), "#e2dcff",
      ["Shave after a warm shower, with the grain.", "A light moisturiser with SPF covers two steps in one.", "Fragrance-free aftercare calms razor burn."], ["Routine finder", "/routine/"]),
    baby: sec("Gentle care for little ones", "Pharmacist-picked basics for babies and new mums.", "Find baby care", "/finder/baby/", art("baby"), "#cfeedd",
      ["Choose fragrance-free products for newborn skin.", "Change nappies often and let skin breathe to prevent rash.", "Ask our pharmacist before using any product on babies under 6 months."], ["Baby finder", "/finder/baby/"]),
    supplements: sec("The right supplement for your goal", "Hair, skin, energy or immunity: start with what you need.", "Find my supplement", "/finder/supplements/", art("supplements"), "#fff3b8",
      ["Supplements support a balanced diet, they don't replace it.", "Check with your doctor or our pharmacist if you take medicines or are pregnant.", "Most hair and skin supplements need 2 to 3 months to show results."], ["Supplement finder", "/finder/supplements/"]),
  },
};

const sectionSchema = z.object({
  enabled: z.boolean(),
  banner: z.object({ title: z.string().max(120), text: z.string().max(300), cta: z.string().max(40), href: z.string().max(300), image: z.string().max(500), bg: z.string().max(20) }),
  tips: z.array(z.string().max(200)).max(10),
  app: z.object({ label: z.string().max(40), href: z.string().max(300) }),
});
export const extrasSchema = z.object({
  anthropicKey: z.string().max(300).default(""),
  advisor: z.object({ enabled: z.boolean(), name: z.string().max(40), greeting: z.string().max(300), suggestions: z.array(z.string().max(80)).max(6), perHour: z.coerce.number().int().min(1).max(500) }),
  youtube: z.object({ enabled: z.boolean(), key: z.string().max(200), pins: z.record(z.string().max(200), z.string().max(20)) }),
  sections: z.record(z.string().max(60), sectionSchema),
});

const KEY = "extras:config";
export async function getExtras(): Promise<Extras> {
  try {
    const raw = await db.cmd<string | null>(["GET", KEY]);
    const v = raw ? (JSON.parse(raw) as Partial<Extras>) : {};
    return {
      anthropicKey: v.anthropicKey ?? "",
      advisor: { ...defaultExtras.advisor, ...v.advisor },
      youtube: { ...defaultExtras.youtube, ...v.youtube },
      sections: { ...defaultExtras.sections, ...v.sections },
    };
  } catch {
    return defaultExtras;
  }
}
/** The Claude key: Vercel setting first, else the one pasted in Admin → Sections & AI. */
export async function anthropicKey(): Promise<string> {
  return process.env.ANTHROPIC_API_KEY || (await getExtras()).anthropicKey || "";
}

/** The section content for a listing: its category, else the concern's area, else the general one. */
export async function sectionFor(category?: string, group?: string) {
  const all = (await getExtras()).sections;
  const byGroup: Record<string, string> = { skin: "skincare", hair: "hair", wellness: "supplements", body: "body", sun: "suncare", makeup: "makeup" };
  const s = (category && all[category]) || (group && all[byGroup[group] ?? group]) || all._all;
  return s?.enabled ? { banner: s.banner, tips: s.tips, app: s.app } : null;
}

export async function saveExtras(e: Extras) {
  await db.cmd(["SET", KEY, JSON.stringify(e)]);
}
