// Supplements: vitamins, capsules, gummies and other food supplements from any feed category are
// grouped under the "supplements" category. Client-safe.

const W = (src: string) => new RegExp(`(?<![\\p{L}\\d])(?:${src})(?![\\p{L}\\d])`, "iu");
// A product is a supplement when its form or label says so (not "Vitamin C serum" or "zinc oxide" sunscreen).
// Clear on their own.
const STRONG = W(String.raw`food supplements?|dietary supplements?|nutritional supplements?|compléments? alimentaires?|complements? alimentaires?|multivitamins?|multi-vitamins?|probiotics?|whey|protein powder|creatine|bcaa|melatonin|mélatonine|omega ?-?3|fish oil|cod liver oil|collagen (drink|powder|shots?|sachets?)`);
// A pill or gummy form, counted only with a nutrient in the name ("Ceramide Capsules" serum and
// "denture tablets" stay where they are).
const WEAK = W(String.raw`capsules?|caps|gélules?|gelules?|tablets?|tabs|comprimés?|comprimes?|softgels?|gummies|gummy|effervescent|sachets?|ampoules? buvables?|drinkable`);
const NUTR = W(String.raw`vitamins?|vitamine?s?|vit\.? ?[abcdek]\d*|minerals?|magnesium|magnésium|zinc|iron|fer|calcium|biotin|biotine|folic|selenium|sélénium|collagen|collagène|hyaluronic|ginseng|echinacea|spirulina|spiruline|q10|coenzyme|glucosamine|ashwagandha|turmeric|curcuma|cranberry|canneberge|ginkgo|elderberry|propolis|royal jelly|gelée royale`);
const NOT_CAT = new Set(["makeup", "fragrance", "nails", "suncare", "oral-care"]);
const BRANDS = new Set(["nutreov", "nhco", "solgar", "arkopharma", "bio-strath", "forte pharma", "fortépharma", "vitabiotics", "centrum", "supradyn", "now foods", "nature's bounty", "natures bounty", "holland & barrett", "inneov", "imedeen", "pileje", "pilèje", "biocyte", "dietaroma", "nutergia", "juvamine", "berocca", "redoxon", "vitascience", "sanct bernhard", "orthomol", "swisse", "optimum nutrition"]);

/** True when a product belongs in Supplements. */
export function isSupplement(p: { name: string; brand: string; category: string }): boolean {
  if (p.category === "supplements") return true;
  if (NOT_CAT.has(p.category)) return false;
  if (BRANDS.has(p.brand.toLowerCase())) return true;
  return STRONG.test(p.name) || (WEAK.test(p.name) && NUTR.test(p.name));
}

export const SUPP_GROUPS: { slug: string; label: string; re: RegExp }[] = [
  { slug: "vitamins", label: "Vitamins & minerals", re: W(String.raw`vitamins?|vitamine?s?|multivit\w*|minerals?|magnesium|zinc|iron|fer|calcium|d3|b12|b-complex|folic|selenium`) },
  { slug: "immunity", label: "Immunity", re: W(String.raw`immun\w*|echinacea|elderberry|sureau|propolis|defen[cs]es?`) },
  { slug: "beauty", label: "Hair, skin & nails", re: W(String.raw`hair|cheveux|skin|peau|nails?|ongles|collagen|collagène|biotin|beauty|beauté|anti-?age`) },
  { slug: "sleep", label: "Sleep & stress", re: W(String.raw`sleep|sommeil|melatonin|mélatonine|stress|relax\w*|ashwagandha|calm\w*|zen|serenity|sérénité`) },
  { slug: "energy", label: "Energy & sport", re: W(String.raw`energy|énergie|energie|fatigue|tonus|vitality|vitalité|sport|protein|whey|creatine|bcaa|ginseng|guarana`) },
  { slug: "digestion", label: "Digestion & detox", re: W(String.raw`probiotics?|digest\w*|gut|transit|detox|drain\w*|liver|foie|flora|flore`) },
  { slug: "joints", label: "Joints & bones", re: W(String.raw`joints?|articul\w*|glucosamine|chondroitin|bones?|cartilage|mobility`) },
  { slug: "weight", label: "Weight & slimming", re: W(String.raw`slim\w*|minceur|weight|burner|brûleur|appetite|satiety|cellulite`) },
  { slug: "heart", label: "Heart & omega 3", re: W(String.raw`omega ?-?3|fish oil|heart|cœur|coeur|cholesterol|cholestérol|q10|coenzyme`) },
  { slug: "women-men", label: "Women & men", re: W(String.raw`women|woman|femmes?|menopause|ménopause|prenatal|pregnan\w*|grossesse|men|man|hommes?|prostate|fertility|fertilité`) },
  { slug: "kids", label: "Kids", re: W(String.raw`kids?|children|child|junior|enfants?`) },
];

export const suppGroup = (slug?: string) => SUPP_GROUPS.find((g) => g.slug === slug);
