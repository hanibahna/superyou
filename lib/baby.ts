// Baby & Mom: every product for babies, children and mothers (pregnancy, nursing) is grouped under
// the "baby" category, whatever category the supplier feed gave it. Client-safe.

const W = (src: string) => new RegExp(`(?<![\\p{L}\\d])(?:${src})(?![\\p{L}\\d])`, "iu");
const BABY = W(String.raw`baby|babies|bébé|bébés|bebe|bebes|infants?|newborns?|nouveau-n[ée]s?|nappy|nappies|diapers?|couches?|liniment|teeth?ing|teethers?|pacifiers?|soothers?|sucettes?|t[ée]tines?|biberons?|feeding bottles?|sippy|cradle cap|cro[uû]tes de lait`);
const MOM = W(String.raw`pregnan\w*|maternity|maternit[ée]|nursing|breast ?feed\w*|breast ?pumps?|tire-lait|nipples?|mamelons?|lactation|postpartum|post-partum|grossesse|allaitement|future maman`);
const KIDS = W(String.raw`kids?|children|child|childrens|junior|enfants?|toddlers?`);
// Grown-up products that only borrow the word ("Baby Lips", "Baby Doll", "Baby Foot" peel, "BaByliss").
const NOT = /\bbaby\s*(lips|skin|doll|face|foot|glow|blush|hair|liss|bangs)\b|babyliss|\bbaby[- ]?(pink|blue)\b/i;
const BRANDS = new Set(["mustela", "biolane", "chicco", "philips avent", "avent", "dr brown's", "dr. brown's", "nuk", "tommee tippee", "mam", "pigeon", "medela", "lansinoh", "suavinex", "petale", "bébé confort", "bebe confort", "mustela bébé", "babybio", "babe pediatric", "babé pediatric"]);
const NEVER = new Set(["makeup", "fragrance-men"]);

/** True when a product belongs in Baby & Mom. */
export function isBabyMom(p: { name: string; brand: string; category: string }): boolean {
  if (p.category === "baby") return true;
  if (NEVER.has(p.category)) return false;
  if (BRANDS.has(p.brand.toLowerCase())) return true;
  const n = `${p.name}`;
  if (NOT.test(n)) return false;
  // Kids' and baby perfumes stay with fragrances only when they aren't clearly for babies.
  if (p.category === "fragrance") return BABY.test(n) && !NOT.test(n);
  return BABY.test(n) || MOM.test(n) || KIDS.test(n);
}

/** Sections inside Baby & Mom, for the menu and the shop filter (?category=baby&sub=…). */
export const BABY_GROUPS: { slug: string; label: string; re: RegExp }[] = [
  { slug: "mom", label: "Pregnancy & nursing", re: MOM },
  { slug: "bath", label: "Baby bath & hair", re: W(String.raw`bath|bain|wash|lavant|shampoo|shampooing|cleansing|nettoyant|gel|soap|savon|water|eau|wipes?|lingettes?|micellar`) },
  { slug: "care", label: "Baby skin care", re: W(String.raw`cream|crème|creme|lotion|balm|baume|milk|lait|oil|huile|moistur\w*|hydra\w*|stelatopia|atop\w*|eczema|cold cream|massage`) },
  { slug: "nappy", label: "Nappy change", re: W(String.raw`nappy|nappies|diapers?|couches?|change|liniment|rash|érythème|erytheme|zinc|barrier|vitamin barrier|wipes?|lingettes?`) },
  { slug: "sun", label: "Baby sun care", re: W(String.raw`sun|solaire|spf|uv|anthelios|after.?sun`) },
  { slug: "feeding", label: "Feeding & soothers", re: W(String.raw`bottles?|biberons?|teats?|t[ée]tines?|pacifiers?|soothers?|sucettes?|sippy|cups?|spoons?|bowls?|plates?|bibs?|teeth?ing|teethers?|steriliz\w*|formula|milk powder`) },
  { slug: "kids", label: "Kids", re: KIDS },
];

export const babyGroup = (slug?: string) => BABY_GROUPS.find((g) => g.slug === slug);
