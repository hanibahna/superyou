// Pharmacist tips that follow the filters a shopper picks. General guidance in line with mainstream
// dermatology and pharmacy advice (e.g. American Academy of Dermatology, NHS); each set ends with when to
// see a doctor or pharmacist. Not a diagnosis. Matched by words in the concern/category slug or name.

type Rule = { match: RegExp; tips: string[] };

const RULES: Rule[] = [
  { match: /acne|blemish|spot|pimple|breakout/i, tips: [
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
    "Replace mascara every 3 months to avoid eye infections.",
    "Clean brushes and sponges weekly.",
    "Remove make-up every night; sleeping in it can clog pores.",
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
