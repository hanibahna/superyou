// Skin Care sections: a short list of product types (?category=skincare&sub=…). Client-safe.

const W = (src: string) => new RegExp(`(?<![\\p{L}\\d])(?:${src})(?![\\p{L}\\d])`, "iu");

export const SKIN_GROUPS: { slug: string; label: string; re: RegExp }[] = [
  { slug: "cleansers", label: "Cleansers & toners", re: W(String.raw`cleans\w*|nettoyant\w*|face wash|wash|foam\w*|mousse|micellar|micellaire|make-?up remover|démaquillant\w*|demaquillant\w*|toner|tonique|lotion tonique|exfoliat\w*|scrub|gommage|peeling|soap|savon|syndet`) },
  { slug: "moisturisers", label: "Moisturisers", re: W(String.raw`moistur\w*|hydrat\w*|hydra\w*|cream|crème|creme|gel-cream|emulsion|fluid|fluide|day care|night care|jour|nuit|bb cream|cc cream|baume|balm|cica\w*`) },
  { slug: "serums", label: "Serums & treatments", re: W(String.raw`serums?|sérums?|ampoules?|essence|concentrate|concentré|booster|retinol|rétinol|retinal|niacinamide|vitamin c|acid|acide|aha|bha|peel|treatment|soin intensif|spot|oil|huile|elixir|élixir`) },
  { slug: "eyes-lips", label: "Eye & lip care", re: W(String.raw`eyes?|yeux|contour|dark circles?|cernes|puffiness|lips?|lèvres|levres|lip balm|stick lèvres`) },
  { slug: "masks", label: "Masks", re: W(String.raw`masks?|masques?|sheet mask|patch(es)?`) },
];

export const skinGroup = (slug?: string) => SKIN_GROUPS.find((g) => g.slug === slug);
