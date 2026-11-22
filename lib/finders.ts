// Section apps: short finder quizzes. Each answer adds search words; the products that match the
// most answers in the section's category win. Client-safe (no server imports).

export type FinderOption = { label: string; q: string };
export type Finder = { id: string; title: string; intro: string; category: string; base: string; questions: { q: string; options: FinderOption[] }[]; note?: string };

const o = (label: string, q: string): FinderOption => ({ label, q });

export const finders: Finder[] = [
  {
    id: "sun", title: "Sun finder", category: "suncare", base: "sunscreen", intro: "Four questions to find the sunscreen you'll actually want to wear.",
    questions: [
      { q: "Your skin is…", options: [o("Oily or acne-prone", "oil free matte"), o("Dry", "hydrating cream"), o("Sensitive", "mineral sensitive"), o("Normal", "fluid")] },
      { q: "Where will you use it?", options: [o("Face, every day", "face"), o("Body", "body"), o("Beach or sport", "water resistant spray"), o("Kids", "kids")] },
      { q: "Do you want a tint?", options: [o("Yes, a tinted finish", "tinted"), o("No, invisible", "invisible")] },
      { q: "How much protection?", options: [o("SPF 50 / 50+", "50"), o("SPF 30", "30")] },
    ],
  },
  {
    id: "makeup", title: "Make-up finder", category: "makeup", base: "", intro: "Tell us the look you want and we'll pick the products to get it.",
    questions: [
      { q: "What are you shopping for?", options: [o("Foundation or tint", "foundation"), o("Concealer", "concealer"), o("Lips", "lipstick"), o("Eyes", "mascara"), o("Brows", "brow")] },
      { q: "Your finish", options: [o("Natural", "natural"), o("Matte", "matte"), o("Glowy", "glow"), o("Long-wear", "long wear")] },
      { q: "Your skin", options: [o("Oily", "oil"), o("Dry", "hydrating"), o("Sensitive", "sensitive"), o("Normal", "")] },
    ],
  },
  {
    id: "hair", title: "Hair finder", category: "hair", base: "", intro: "Match care to your hair type and what bothers you most.",
    questions: [
      { q: "Your hair is…", options: [o("Fine", "volume"), o("Thick", "nourishing"), o("Curly", "curl"), o("Coloured", "color")] },
      { q: "What bothers you most?", options: [o("Frizz", "frizz smoothing"), o("Dryness", "dry repair"), o("Hair fall", "anti hair loss"), o("Dandruff", "dandruff"), o("Oily scalp", "purifying")] },
      { q: "What do you need?", options: [o("Shampoo", "shampoo"), o("Conditioner or mask", "mask"), o("Serum or oil", "serum oil"), o("A full set", "")] },
    ],
    note: "Sudden or patchy hair loss is worth a free video call with our pharmacist.",
  },
  {
    id: "body", title: "Body finder", category: "body", base: "", intro: "Soft, smooth, fragrant: find your body care.",
    questions: [
      { q: "Your body skin is…", options: [o("Very dry", "dry repair"), o("Rough (elbows, heels)", "urea"), o("Sensitive", "sensitive"), o("Normal", "")] },
      { q: "What do you want?", options: [o("Body lotion or cream", "lotion cream"), o("Shower gel or oil", "shower"), o("Deodorant", "deodorant"), o("Hand or foot care", "hand foot")] },
      { q: "Scent", options: [o("Fragrance-free", "fragrance free"), o("Light and fresh", "fresh"), o("Sweet or warm", "vanilla")] },
    ],
  },
  {
    id: "fragrance", title: "Scent finder", category: "fragrance", base: "", intro: "Four questions to find a scent that feels like you.",
    questions: [
      { q: "Who is it for?", options: [o("Me (women's)", "women"), o("Me (men's)", "men"), o("Anyone", "unisex"), o("A gift", "gift set")] },
      { q: "Which mood?", options: [o("Fresh and clean", "fresh citrus"), o("Floral", "floral rose"), o("Sweet", "vanilla"), o("Woody or warm", "wood oud amber")] },
      { q: "When will you wear it?", options: [o("Every day", "eau de toilette"), o("Evenings", "eau de parfum"), o("Gym and summer", "body mist")] },
    ],
  },
  {
    id: "baby", title: "Baby finder", category: "baby", base: "", intro: "Gentle basics, picked by our pharmacists.",
    questions: [
      { q: "Your baby is…", options: [o("Newborn to 6 months", "newborn"), o("6 to 24 months", "baby"), o("Toddler", "kids")] },
      { q: "What do you need?", options: [o("Bath and wash", "wash"), o("Nappy cream", "nappy cream"), o("Moisturiser", "moisturizing"), o("Sun protection", "sun"), o("For mum", "mom stretch")] },
    ],
    note: "Ask our pharmacist before using any product on babies under 6 months.",
  },
  {
    id: "supplements", title: "Supplement finder", category: "supplements", base: "", intro: "Start with your goal. We'll show supplements that support it.",
    questions: [
      { q: "Your goal", options: [o("Hair, skin and nails", "hair skin nails"), o("Energy", "energy b12"), o("Immunity", "vitamin c zinc"), o("Bones and joints", "calcium vitamin d"), o("Sleep and stress", "magnesium")] },
      { q: "Preferred form", options: [o("Tablets or capsules", "capsules tablets"), o("Gummies", "gummies"), o("Drink or sachet", "effervescent"), o("No preference", "")] },
    ],
    note: "Check with your doctor or our pharmacist if you take medicines, are pregnant or breastfeeding.",
  },
];

export const finderById = (id: string) => finders.find((f) => f.id === id);
