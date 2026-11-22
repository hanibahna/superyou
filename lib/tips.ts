// Pharmacist tips that follow the filters a shopper picks. General guidance in line with mainstream
// dermatology and pharmacy advice (e.g. American Academy of Dermatology, NHS); each set ends with when to
// see a doctor or pharmacist. Not a diagnosis. Matched by words in the concern/category slug or name.

type Rule = { match: RegExp; tips: string[] };

const RULES: Rule[] = [
  { match: /acne|blemish|pimple|breakout|imperfection/i, tips: [
    "Wash twice a day and after sweating with a gentle cleanser; scrubbing makes acne worse.",
    "Benzoyl peroxide, salicylic acid and adapalene are the proven over-the-counter actives. Give each 6 to 8 weeks.",
    "Look for 'non-comedogenic' or 'oil-free' on moisturisers and sunscreen.",
    "Don't pick or squeeze spots: it raises the risk of marks and scars.",
    "See a doctor for painful deep lumps, acne that scars, or no improvement after 2 to 3 months." ] },
  { match: /dry|dehydrat|hydrat/i, tips: [
    "Apply moisturiser within 3 minutes of washing, while skin is still damp.",
    "Creams and ointments hold water better than lotions; look for ceramides, glycerin or hyaluronic acid.",
    "Short, lukewarm showers and fragrance-free cleansers dry the skin less.",
    "See a doctor if dry skin cracks, bleeds, itches badly or doesn't improve in 2 weeks." ] },
  { match: /eczema|atopic|itch/i, tips: [
    "Use a fragrance-free emollient generously, at least twice a day, even when skin looks clear.",
    "Choose soap-free washes and pat skin dry rather than rubbing.",
    "Cotton clothing and unscented laundry products cause less irritation.",
    "See a doctor or pharmacist for weeping, crusting or spreading patches: they may need a prescription." ] },
  { match: /sensitiv|redness|rosacea|irritat/i, tips: [
    "Keep the routine short: gentle cleanser, moisturiser, mineral sunscreen.",
    "Fragrance, alcohol and strong acids are common triggers; add one new product at a time.",
    "Patch-test new products on the inner arm or behind the ear for 2 to 3 days.",
    "See a doctor for persistent facial redness with bumps or visible vessels; it may be rosacea." ] },
  { match: /pigment|dark.?spot|melasma|bright|even|uneven/i, tips: [
    "Daily broad-spectrum SPF 30+ is the most important step; dark spots return without it.",
    "Vitamin C, niacinamide, azelaic acid and retinoids fade spots over 8 to 12 weeks.",
    "Tinted mineral sunscreen with iron oxides also helps against visible light that darkens melasma.",
    "Show a doctor any spot that changes size, shape or colour, bleeds or itches." ] },
  { match: /aging|ageing|wrinkle|firm|line/i, tips: [
    "Sunscreen every morning prevents more ageing than any cream.",
    "Retinoids have the strongest evidence for fine lines; start 2 to 3 nights a week.",
    "Retinoids are not for pregnancy or breastfeeding: ask our pharmacist for alternatives.",
    "Moisturise and use vitamin C in the morning, retinoid at night, not together." ] },
  { match: /oily|shine|pore|sebum/i, tips: [
    "Oily skin still needs a light, oil-free moisturiser; stripping it can increase oil.",
    "Niacinamide and salicylic acid help with shine and visible pores.",
    "Blotting papers remove shine during the day without disturbing make-up." ] },
  { match: /sun|spf|uv/i, tips: [
    "Use SPF 30 or higher, broad spectrum, and about a teaspoon for face and neck.",
    "Reapply every 2 hours outdoors and after swimming or sweating.",
    "Avoid the strongest sun between 11 am and 3 pm, even with sunscreen.",
    "Babies under 6 months should be kept out of direct sun rather than covered in sunscreen." ] },
  { match: /hair.?loss|hair.?fall|thinning|alopecia/i, tips: [
    "Losing 50 to 100 hairs a day is normal.",
    "Minoxidil is the proven over-the-counter treatment; results take 3 to 6 months.",
    "Low iron, thyroid problems and stress are common causes: a blood test can check.",
    "See a doctor for sudden, patchy or heavy hair loss, or loss with scalp pain or redness." ] },
  { match: /dandruff|scalp|flak/i, tips: [
    "Use an anti-dandruff shampoo (zinc pyrithione, ketoconazole or selenium) 2 to 3 times a week.",
    "Leave it on the scalp for 3 to 5 minutes before rinsing.",
    "If one type stops working, switching to another active often helps.",
    "See a doctor if the scalp is red, sore, or flaking spreads to the face or body." ] },
  { match: /colou?r|dyed|damag|frizz|curl|split/i, tips: [
    "Use heat protection every time you blow-dry or straighten.",
    "A weekly mask and leave-in conditioner help dry, coloured or curly hair.",
    "Wash coloured hair in lukewarm water and use colour-safe shampoo to keep the colour longer." ] },
  { match: /heal|repair|scar|wound|cica|barrier/i, tips: [
    "Keep minor cuts clean and covered; a thin layer of petrolatum helps them heal with less scarring.",
    "Cica (centella) and panthenol creams soothe and support the skin barrier.",
    "Protect healing skin and new scars from the sun to stop them darkening.",
    "See a doctor for wounds that are deep, hot, swollen, leaking pus, or not healing in 2 weeks." ] },
  { match: /immun|vitamin.?c|zinc|cold/i, tips: [
    "Supplements support but don't replace a varied diet with fruit and vegetables.",
    "Vitamin D is often low in Lebanon in winter; ask our pharmacist about a level check.",
    "Check with a doctor or pharmacist before supplements if you take medicines, are pregnant or breastfeeding." ] },
  { match: /sleep|stress|magnes|melaton/i, tips: [
    "Keep regular sleep times and avoid screens for an hour before bed.",
    "Melatonin is best for short-term jet lag or shift changes, not long-term use without advice.",
    "Talk to a doctor if poor sleep lasts more than a few weeks." ] },
  { match: /energy|fatigue|b12|iron/i, tips: [
    "Tiredness can come from low iron, B12 or vitamin D: a blood test tells you what you need.",
    "Don't take iron supplements without checking: too much can be harmful.",
    "See a doctor for tiredness that lasts more than a few weeks." ] },
  { match: /bone|joint|calcium/i, tips: [
    "Calcium works with vitamin D; most adults need both from food, sun or supplements.",
    "Weight-bearing exercise like walking keeps bones strong.",
    "Ask a doctor before supplements if you have kidney stones or take heart medicines." ] },
  { match: /digest|gut|probiotic/i, tips: [
    "Fibre, water and regular meals support digestion.",
    "Probiotics may help after antibiotics; choose one with named strains.",
    "See a doctor for blood in stools, weight loss, or symptoms lasting more than 3 weeks." ] },
  { match: /baby|infant|newborn|kid|child/i, tips: [
    "Choose fragrance-free products for babies' skin.",
    "For nappy rash, change often, let skin air-dry and use a zinc oxide barrier cream.",
    "Ask our pharmacist before using any medicated product on a baby under 6 months.",
    "See a doctor if a baby's rash comes with fever, blisters or doesn't settle in 3 days." ] },
  { match: /pregnan|maternity|mom|mum|stretch/i, tips: [
    "Avoid retinoids and high-dose vitamin A in pregnancy; azelaic acid and vitamin C are usually preferred.",
    "Moisturising early may help skin feel more comfortable as it stretches.",
    "Check every medicine and supplement with your doctor or pharmacist during pregnancy." ] },
  { match: /fragrance|perfume|parfum|scent/i, tips: [
    "Test perfume on skin and wait 20 minutes before deciding.",
    "Spray on pulse points and don't rub: it breaks down the top notes.",
    "If you have eczema or sensitive skin, spray on clothes rather than skin." ] },
  { match: /makeup|make-up|foundation|lip|mascara|eye/i, tips: [
    "Remove make-up every night; sleeping in it can clog pores.",
    "Clean brushes and sponges weekly.",
    "Replace mascara every 3 months to avoid eye infections.",
    "Stop any eye product that stings, and see a doctor if eye redness or pain lasts." ] },
  { match: /nail/i, tips: [
    "Cuticle oil daily keeps nails flexible and less likely to split.",
    "Give nails a few polish-free days between manicures.",
    "See a doctor for discoloured, thickened or painful nails: it may be a fungal infection." ] },
  { match: /\bmen'?s?\b|shav|beard/i, tips: [
    "Shave after a warm shower, with the grain, using a sharp blade.",
    "A fragrance-free aftercare balm calms razor burn.",
    "Men's skin needs sunscreen too: a moisturiser with SPF covers both steps." ] },
];

/** Tips for the current filters: selected concerns first, then the category; up to 6. */
export function tipsFor(words: (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const w of words) {
    if (!w) continue;
    for (const r of RULES) if (r.match.test(w)) for (const t of r.tips) if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, 6);
}

// Product-specific tips: matched on the product's own name (and ingredients when we have them).
const PRODUCT: Rule[] = [
  { match: /sponge|blender|puff/i, tips: ["Dampen the sponge and squeeze out the water, then bounce it on the skin rather than dragging.", "Wash make-up sponges after each use, let them dry fully and replace them every 1 to 3 months."] },
  { match: /brush/i, tips: ["Wash make-up brushes weekly with a gentle shampoo and dry them flat so water doesn't loosen the bristles."] },
  { match: /tweezer/i, tips: ["Clean tweezers with alcohol before and after use; plucking after a warm shower hurts less."] },
  { match: /dryer|straightener|flat ?iron|curl(er|ing)|styler/i, tips: ["Always use a heat protectant first, and keep styling tools at the lowest heat that works for your hair."] },
  { match: /razor|blade|shaver/i, tips: ["Change razor blades every 5 to 7 shaves and rinse them after each stroke to avoid irritation."] },
  { match: /nail ?file|clipper|cuticle ?(pusher|nipper)/i, tips: ["File nails in one direction and disinfect clippers and nippers after each use."] },
  { match: /eyelash ?curler/i, tips: ["Curl lashes before mascara, never after, and replace the curler pad every few months."] },
  { match: /retinol|retinal|retinoid|adapalene|bakuchiol/i, tips: ["Use retinol at night only, starting 2 to 3 times a week, and wear SPF 30+ every morning.", "Apply retinol to dry skin, a pea-sized amount for the whole face. Not for pregnancy or breastfeeding."] },
  { match: /vitamin\s*c|ascorbic|\bvit\.?\s*c\b/i, tips: ["Apply vitamin C in the morning under sunscreen; keep it closed and away from light so it stays effective."] },
  { match: /niacinamide/i, tips: ["Niacinamide suits most skin types and can be used morning and night, alongside other actives."] },
  { match: /glycolic|lactic|aha\b|mandelic|peel/i, tips: ["Exfoliating acids make skin more sun-sensitive: use them at night and wear SPF the next day. Start 2 to 3 times a week."] },
  { match: /salicylic|bha\b/i, tips: ["Salicylic acid unclogs pores: start once a day and moisturise if skin feels dry."] },
  { match: /benzoyl/i, tips: ["Benzoyl peroxide can bleach towels and pillowcases; start with a thin layer once a day."] },
  { match: /hyaluronic/i, tips: ["Apply hyaluronic acid on damp skin, then seal it in with moisturiser."] },
  { match: /spf|sunscreen|sun\s*(cream|fluid|spray|stick|milk)|uv\b|anthelios|photoderm/i, tips: ["Apply sunscreen 15 minutes before going out, about a teaspoon for face and neck, and reapply every 2 hours outdoors."] },
  { match: /cleanser|cleansing|micellar|face\s*wash|gel\s*nettoyant/i, tips: ["Cleanse for about 30 seconds with lukewarm water and pat dry; twice a day is enough."] },
  { match: /serum/i, tips: ["Apply serums after cleansing and before moisturiser, on dry skin."] },
  { match: /eye\s*cream|contour|eye\s*gel/i, tips: ["Tap eye cream gently with the ring finger along the orbital bone, not on the lids."] },
  { match: /mascara/i, tips: ["Replace mascara every 3 months and never share it, to avoid eye infections."] },
  { match: /foundation|concealer|bb\s*cream|cc\s*cream|tinted/i, tips: ["Test shade on the jawline in daylight; apply over moisturiser and sunscreen."] },
  { match: /lipstick|lip\s*(gloss|balm|liner|tint)/i, tips: ["Exfoliate lips gently and apply balm first for a smoother, longer-lasting finish."] },
  { match: /nail\s*polish|vernis|gel\s*polish/i, tips: ["Use a base coat to prevent staining and a top coat to make polish last longer."] },
  { match: /minoxidil/i, tips: ["Minoxidil must be used every day to keep results; shedding in the first weeks is normal. Not for pregnancy."] },
  { match: /shampoo/i, tips: ["Massage shampoo into the scalp, not the lengths, and rinse well."] },
  { match: /conditioner|mask|masque|après/i, tips: ["Apply conditioner or masks to mid-lengths and ends, leave 2 to 5 minutes, then rinse."] },
  { match: /oil\b|huile/i, tips: ["A few drops are enough; warm oil between your palms before applying."] },
  { match: /deodorant|anti-?perspirant/i, tips: ["Antiperspirant works best applied at night on clean, dry skin."] },
  { match: /body\s*(lotion|milk|cream|butter)|lait\s*corps/i, tips: ["Apply body lotion within 3 minutes of showering, on slightly damp skin."] },
  { match: /hand\s*cream|crème\s*mains/i, tips: ["Reapply hand cream after every wash; at night, use a thick layer and cotton gloves for very dry hands."] },
  { match: /perfume|parfum|eau de|cologne|body\s*mist/i, tips: ["Spray perfume on pulse points from about 15 cm away and don't rub it in."] },
  { match: /collagen/i, tips: ["Collagen supplements need 8 to 12 weeks of daily use; take them consistently."] },
  { match: /biotin/i, tips: ["High-dose biotin can affect some blood test results: tell your lab before any test."] },
  { match: /\biron\b|ferrous|fer\b|actiheme|heme/i, tips: ["Take iron with vitamin C (like orange juice), not with tea, coffee or dairy, which reduce absorption. Don't exceed the dose: iron can be harmful in excess."] },
  { match: /vitamin\s*d|d3\b/i, tips: ["Vitamin D is best absorbed with a meal that contains some fat."] },
  { match: /magnesium/i, tips: ["Magnesium is often taken in the evening; it can loosen stools at higher doses."] },
  { match: /omega|fish\s*oil/i, tips: ["Take omega-3 with food to reduce aftertaste and improve absorption."] },
  { match: /probiotic/i, tips: ["Take probiotics at the same time each day; if on antibiotics, keep them 2 hours apart."] },
  { match: /zinc/i, tips: ["Take zinc with food if it upsets your stomach; long-term high doses need a doctor's advice."] },
  { match: /baby|bébé|infant|nappy|diaper/i, tips: ["Check the age on the label and ask our pharmacist before use on babies under 6 months."] },
];

/** Tips for one product (its type and ingredients), then its concerns and category. */
export function productTips(p: { name: string; category?: string; concerns?: string[]; text?: string }): string[] {
  const hay = `${p.name} ${p.text ?? ""}`;
  const out: string[] = [];
  for (const r of PRODUCT) if (r.match.test(hay)) for (const t of r.tips) if (!out.includes(t)) out.push(t);
  for (const t of tipsFor([...(p.concerns ?? []), p.category])) if (!out.includes(t)) out.push(t);
  return out.slice(0, 6);
}

/** Tips for a listing: the products shown on the page first (most common types), then the filters. */
export function listingTips(products: { name: string; category: string; concerns: string[] }[], filters: (string | undefined)[]): string[] {
  const score = new Map<string, number>();
  for (const p of products.slice(0, 24)) for (const r of PRODUCT) if (r.match.test(p.name)) for (const t of r.tips) score.set(t, (score.get(t) ?? 0) + 1);
  const fromProducts = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 3);
  const out = [...tipsFor(filters).slice(0, 3), ...fromProducts];
  for (const t of tipsFor(products.slice(0, 24).flatMap((p) => [...p.concerns, p.category]))) if (out.length < 6 && !out.includes(t)) out.push(t);
  return [...new Set(out)].slice(0, 6);
}
