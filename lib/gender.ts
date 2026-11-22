// Men / Women filter. Products say who they're for in their category or name; everything else is
// for everyone. "Women" hides men-only items; "Men" shows men's items plus unisex care
// (skin, hair, sun, body, fragrance, supplements), not make-up, nails or baby.
const MEN = /\b(men'?s?|man|homme|pour homme|for him|male|beard|shav(e|ing)|after ?shave|barber|moustache)\b/i;
const WOMEN = /\b(women'?s?|woman|femme|pour femme|for her|ladies|lady|feminine|intimate|maternity|pregnan\w*|breast|bra)\b/i;
const NOT_FOR_MEN = new Set(["makeup", "nails", "baby"]);

export type Gender = "men" | "women" | "unisex";
export function genderOf(p: { name: string; category: string; brand?: string }): Gender {
  if (p.category === "men") return "men";
  const t = `${p.name}`;
  const m = MEN.test(t), w = WOMEN.test(t);
  if (m && !w) return "men";
  if (w && !m) return "women";
  return "unisex";
}
export function forShopper(p: { name: string; category: string }, who: "men" | "women"): boolean {
  const g = genderOf(p);
  return who === "women" ? g !== "men" : g === "men" || (g === "unisex" && !NOT_FOR_MEN.has(p.category));
}
