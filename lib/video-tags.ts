import type { Taxonomy } from "@/lib/data/catalog";

const n = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

// Extra words that point to a category / concern even when its name isn't in the title.
const catHints: Record<string, string[]> = {
  skincare: ["serum", "moistur", "cleanser", "skincare", "skin care", "retinol", "toner", "acne", "niacinamide", "hyaluronic"],
  suncare: ["spf", "sunscreen", "sun cream", "sunblock", "uv"],
  makeup: ["makeup", "foundation", "mascara", "lipstick", "concealer", "blush"],
  hair: ["hair", "shampoo", "conditioner", "scalp", "dandruff"],
  body: ["body lotion", "shower", "body wash", "deodorant"],
  supplements: ["vitamin", "supplement", "collagen", "omega", "magnesium", "zinc", "probiotic"],
  baby: ["baby", "infant", "diaper", "newborn"],
  "oral-care": ["tooth", "teeth", "oral", "mouthwash"],
  men: ["men", "beard", "shaving"],
};
const concernHints: Record<string, string[]> = {
  acne: ["acne", "pimple", "breakout", "blemish"],
  "anti-aging": ["wrinkle", "anti-aging", "anti aging", "retinol", "fine lines"],
  pigmentation: ["dark spot", "pigment", "melasma", "brighten"],
  dryness: ["dry skin", "dehydrat", "hydrat"],
  sensitive: ["sensitive"],
  "oily-skin": ["oily", "pores", "sebum"],
  "hair-loss": ["hair loss", "hair fall", "thinning"],
  dandruff: ["dandruff", "flaky scalp"],
  sleep: ["sleep", "stress", "melatonin"],
  immunity: ["immun", "cold and flu"],
};

/** Suggest categories / brands / concerns for a video from its title. */
export function suggestTags(title: string, tax: Taxonomy, brands: string[]) {
  const t = ` ${n(title)} `;
  const categories = tax.categories.filter((c) => t.includes(n(c.name)) || (catHints[c.slug] ?? []).some((h) => t.includes(h))).map((c) => c.slug);
  const concerns = tax.concerns.filter((c) => t.includes(n(c.name)) || (concernHints[c.slug] ?? []).some((h) => t.includes(h))).map((c) => c.slug);
  const found = brands.filter((b) => b.length > 2 && new RegExp(`\\b${n(b).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t));
  return { categories: categories.slice(0, 5), brands: found.slice(0, 5), concerns: concerns.slice(0, 5) };
}
