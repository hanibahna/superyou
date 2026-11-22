// Puts imported products into the same menu collections as the local catalogs
// (Make Up › Eyes › Mascara and so on), from the product name, type and tags.
// The first matching rule wins; an item can also join a palette collection.

type Rule = [RegExp, string];
const R = (s: string) => new RegExp(s, "i");

const RULES: Rule[] = [
  [R("brush (cleaner|shampoo)"), "make-up-beauty-tools-brushes-brush-cleaners"],
  [R("brush set|brushes set|\\d+ ?pcs? brush"), "make-up-beauty-tools-brushes-brush-sets"],
  [R("\\blip brush"), "make-up-beauty-tools-brushes-lip-brush"],
  [R("\\beye ?(shadow )?brush|blending brush|crease brush"), "make-up-beauty-tools-brushes-eye-brush-1"],
  [R("tweezer"), "make-up-beauty-tools-brushes-tweezers-eyebrow-tools"],
  [R("lash curler|eyelash curler"), "make-up-beauty-tools-brushes-eyelash-curler"],
  [R("sharpener"), "make-up-beauty-tools-brushes-sharpeners"],
  [R("\\bmirror\\b"), "make-up-beauty-tools-brushes-mirrors"],
  [R("makeup (bag|case|pouch)|cosmetic (bag|case)|train case"), "make-up-beauty-tools-brushes-make-up-cases-pouches"],
  [R("nail polish remover|polish remover|acetone"), "make-up-nails-nail-polish-remover"],
  [R("(?<!lip )top coat|base coat"), "make-up-nails-base-top-coats"],
  [R("nail (file|clipper|tool|art|sticker|strip)|cuticle|false nails|press[- ]on|nail tips"), "make-up-nails-manicure-pedicure-tools"],
  [R("nail (polish|lacquer|colou?r|enamel)|gel polish|\\bpolish\\b"), "make-up-nails-nail-polish"],
  [R("nail (treatment|care|strengthener|growth)"), "make-up-nails-nail-care"],
  [R("makeup remover|make-up remover|micellar|cleansing (wipe|water|balm|oil)"), "skin-care-cleansers-make-up-removers"],
  [R("lash (serum|growth)|brow (serum|growth)"), "make-up-eyes-lashes"],
  [R("eyebrow|\\bbrows?\\b"), "make-up-eyes-brows"],
  [R("mascara"), "make-up-eyes-mascara"],
  [R("eye ?liner|kohl|kajal|eye pencil|liner pen"), "make-up-eyes-eyeliners"],
  [R("false (eye)?lash|eyelash|\\blashes\\b|lash adhesive|lash glue|\\bmink\\b"), "make-up-eyes-lashes"],
  [R("\\bbrush"), "make-up-beauty-tools-brushes-face-brush-1"],
  [R("sponge|blender|powder puff|\\bpuff\\b|applicator"), "make-up-beauty-tools-brushes-sponges-applicators"],
  [R("eye ?shadow|eye palette|shadow palette|pigment"), "make-up-eyes-eyeshadow"],
  [R("eye primer|shadow primer|eye base"), "make-up-eyes-eye-primer"],
  [R("concealer|corrector"), "make-up-eyes-concealer"],
  [R("lip ?(liner|pencil)"), "make-up-lips-lip-liner"],
  [R("plump"), "make-up-lips-lip-plumper"],
  [R("lip ?(balm|treatment|oil|mask|scrub|exfoliat\\w*|butter|care)|chapstick|carmex|blistex"), "skin-care-moisturizers-lip-care"],
  [R("gloss"), "make-up-lips-lip-gloss"],
  [R("lipstick|lip ?(colou?r|crayon|stain|tint|cream|paint)|liquid lip|matte lip|lip kit|\\blips?\\b"), "make-up-lips-lipstick"],
  [R("mist (&|and) set|setting spray|finishing spray|fixing spray|setting mist|fix\\+?"), "make-up-face-setting-spray"],
  [R("primer"), "make-up-face-base-primer"],
  [R("foundation|bb cream|cc cream|skin tint|tinted moisturi"), "make-up-face-foundation"],
  [R("contour"), "make-up-face-contour"],
  [R("highlight|illuminat|lumini|strobe|shimmer|glow"), "make-up-face-highlighter-luminizer"],
  [R("bronz"), "make-up-face-bronzer"],
  [R("blush|cheek"), "make-up-face-blush"],
  [R("powder"), "make-up-face-powder"],
  [R("toner"), "skin-care-cleansers-toners"],
  [R("cleanser|face wash|facial wash|cleansing foam"), "skin-care-cleansers-face-wash-cleansers"],
  [R("scrub|exfoliat|peeling"), "skin-care-cleansers-scrubs-exfoliators"],
  [R("sheet mask|tissue mask"), "skin-care-masks-patches-tissue-masks"],
  [R("eye (patch|pad)|under ?eye patch"), "skin-care-masks-patches-eye-patches"],
  [R("\\bmask\\b"), "skin-care-masks-patches-face-masks"],
  [R("serum|ampoule|essence|booster drops|fac(e|ial) oil"), "skin-care-moisturizers-face-serums"],
  [R("eye cream|eye gel|under ?eye"), "skin-care-moisturizers-eye-care"],
  [R("moisturi|face cream|day cream|night cream|\\bgel cream"), "skin-care-moisturizers-day-night-care"],
  [R("sunscreen|\\bspf\\b|sun block|sunblock"), "skin-care-sun-care-self-tanning-sunscreens"],
  [R("hair (colou?r|dye)|bleach"), "hair-expert-hair-color-permenant-hair-color"],
  [R("shampoo"), "hair-expert-hair-care-shampoo"],
  [R("conditioner"), "hair-expert-hair-care-conditioner"],
  [R("hair (oil|serum)"), "hair-expert-hair-treatment-hair-oils"],
  [R("hair ?spray"), "hair-expert-hair-styling-hair-spray"],
  [R("hair (gel|wax|pomade)|edge control"), "hair-expert-hair-styling-hair-gel"],
  [R("body (lotion|oil|cream|butter)"), "skin-care-body-care-body-lotion-oils"],
  [R("wax strips?|body wax|hair remov|depilat"), "bath-body-hair-removal-waxing"],
];

const PALETTE: Rule[] = [
  [R("palette"), ""],
];

const parentOf = (k: string) => (k.startsWith("make-up-") ? "make-up" : k.startsWith("skin-care-") ? "skin-care" : k.startsWith("hair-expert-") ? "hair-expert" : "");

export function collectionsFor(name: string, type = "", tags: string[] = []): string[] {
  // Name and type first: store tags are often broad ("Brushes" on a lipstick), so they only break a tie.
  const text = `${name} ${type}`;
  const hit = (RULES.find(([re]) => re.test(text)) ?? RULES.find(([re]) => re.test(tags.join(" "))))?.[1];
  const out = new Set<string>();
  if (hit) (out.add(hit), parentOf(hit) && out.add(parentOf(hit)));
  if (PALETTE[0][0].test(text) && hit?.startsWith("make-up-")) {
    out.add(/eye|shadow/i.test(text) ? "make-up-palettes-sets-eyes" : /lip/i.test(text) ? "make-up-palettes-sets-lips" : "make-up-palettes-sets-face");
  }
  return [...out];
}
