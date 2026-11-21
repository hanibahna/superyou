// Skincare routine wizard: questions, steps and the matching logic. Client-safe.

import { z } from "zod";

export type RoutineStep = {
  id: string;
  name: string; // "Cleanser"
  time: "am" | "pm" | "both";
  essential: boolean; // included in the 3-step "essentials" routine
  keywords: string[]; // product name must contain one of these
  exclude: string[]; // …and none of these
  categories: string[]; // category slugs to look in
  tip: string; // short how-to shown under the step
  pinned: string[]; // SKUs to always offer first for this step
};

export type ConcernOption = { label: string; concerns: string[]; keywords: string[] };

export type RoutineConfig = {
  enabled: boolean;
  title: string;
  intro: string;
  skinTypes: { id: string; label: string; hint: string; keywords: string[] }[];
  concernOptions: ConcernOption[];
  goals: { label: string; keywords: string[] }[];
  steps: RoutineStep[];
  alternatives: number; // extra choices shown per step
};

export const defaultRoutine: RoutineConfig = {
  enabled: true,
  title: "Build your skincare routine",
  intro: "Answer 5 quick questions and our pharmacists' rules will build a morning and evening routine for your skin.",
  skinTypes: [
    { id: "dry", label: "Dry", hint: "Feels tight, flaky or rough", keywords: ["hydrat", "nourish", "rich", "dry", "cica", "barrier", "ceramide"] },
    { id: "oily", label: "Oily", hint: "Shiny all over by midday", keywords: ["oil", "matt", "purif", "gel", "foam", "sebum", "pore", "niacinamide"] },
    { id: "combination", label: "Combination", hint: "Oily T-zone, normal or dry cheeks", keywords: ["balanc", "gel", "fluid", "light", "matt"] },
    { id: "normal", label: "Normal", hint: "Comfortable, rarely shiny or tight", keywords: ["daily", "hydrat", "light"] },
    { id: "sensitive", label: "Sensitive", hint: "Reacts, stings or reddens easily", keywords: ["sensitiv", "gentle", "calm", "sooth", "tolerance", "fragrance-free", "cica"] },
  ],
  concernOptions: [
    { label: "Acne & blemishes", concerns: ["acne"], keywords: ["acne", "blemish", "salicylic", "bha", "purif", "effaclar", "sebium", "cleanance"] },
    { label: "Fine lines & wrinkles", concerns: ["anti-aging"], keywords: ["retinol", "peptide", "lift", "wrinkle", "age", "collagen", "firm"] },
    { label: "Dark spots & uneven tone", concerns: ["pigmentation"], keywords: ["spot", "bright", "vitamin c", "pigment", "glow", "radiance", "tranexamic"] },
    { label: "Dryness & dehydration", concerns: ["dryness"], keywords: ["hyaluronic", "hydra", "moist", "ceramide", "nourish"] },
    { label: "Redness & irritation", concerns: ["redness", "sensitive"], keywords: ["redness", "rosacea", "calm", "sooth", "cica", "anti-red"] },
    { label: "Oiliness & large pores", concerns: ["oily-skin"], keywords: ["pore", "matt", "sebum", "niacinamide", "oil control"] },
    { label: "Eczema / very dry patches", concerns: ["eczema"], keywords: ["atop", "eczema", "lipikar", "atoderm", "xera", "emollient"] },
  ],
  goals: [
    { label: "Glow & radiance", keywords: ["glow", "radiance", "vitamin c", "bright"] },
    { label: "Hydration & comfort", keywords: ["hydrat", "hyaluronic", "moist"] },
    { label: "Clear, calm skin", keywords: ["purif", "clear", "calm"] },
    { label: "Firmer, younger-looking skin", keywords: ["firm", "lift", "retinol", "peptide"] },
    { label: "Sun protection", keywords: ["spf", "uv"] },
  ],
  steps: [
    { id: "cleanser", name: "Cleanser", time: "both", essential: true, keywords: ["cleanser", "cleansing", "face wash", "facial wash", "micellar", "foaming gel", "cleansing gel", "wash gel", "gel moussant"], exclude: ["body", "intimate", "hair", "shampoo", "baby", "hand"], categories: ["skincare"], tip: "Massage onto damp skin for 30–60 seconds, rinse with lukewarm water.", pinned: [] },
    { id: "toner", name: "Toner or exfoliant", time: "pm", essential: false, keywords: ["toner", "tonic", "lotion tonique", "exfoliat", "peeling", "aha", "bha", "glycolic"], exclude: ["body", "hair", "foot", "cleanser", "cleansing", "wash", "gel moussant"], categories: ["skincare"], tip: "Apply on a cotton pad or with your hands after cleansing. Exfoliants 2–3 evenings a week.", pinned: [] },
    { id: "serum", name: "Serum", time: "both", essential: false, keywords: ["serum", "sérum", "ampoule", "essence", "concentrate", "booster"], exclude: ["hair", "lash", "brow", "eye", "body", "nail"], categories: ["skincare"], tip: "3–4 drops on face and neck before moisturiser. Vitamin C in the morning, retinol at night.", pinned: [] },
    { id: "eye", name: "Eye care", time: "both", essential: false, keywords: ["eye cream", "eye contour", "eye gel", "eye serum", "contour des yeux", "eye"], exclude: ["makeup", "liner", "shadow", "mascara", "remover", "pencil"], categories: ["skincare"], tip: "Tap a rice-grain amount around the orbital bone with your ring finger.", pinned: [] },
    { id: "moisturiser", name: "Moisturiser", time: "both", essential: true, keywords: ["moisturi", "cream", "crème", "emulsion", "gel-cream", "gel cream", "fluid", "balm"], exclude: ["eye", "hand", "body", "foot", "hair", "spf", "sun", "cleans", "night", "diaper", "nappy", "shaving"], categories: ["skincare"], tip: "Warm a pea-sized amount between fingertips and press into the skin.", pinned: [] },
    { id: "spf", name: "Sunscreen", time: "am", essential: true, keywords: ["spf", "sunscreen", "sun protect", "uv"], exclude: ["body", "lip", "after sun", "self tan", "kids", "baby", "spray"], categories: ["suncare", "skincare"], tip: "Last step every morning: two finger-lengths for face and neck. Reapply every 2 hours outdoors.", pinned: [] },
    { id: "night", name: "Night treatment", time: "pm", essential: false, keywords: ["night", "retinol", "retinal", "sleeping mask", "overnight", "nuit"], exclude: ["eye", "hair", "body", "hand", "lip"], categories: ["skincare"], tip: "Apply after serum on dry skin. Start retinol 2–3 nights a week.", pinned: [] },
  ],
  alternatives: 2,
};

const words = z.array(z.string().min(1).max(60)).max(60);
export const routineSchema = z.object({
  enabled: z.boolean(),
  title: z.string().min(1).max(120),
  intro: z.string().max(500),
  skinTypes: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), label: z.string().min(1).max(40), hint: z.string().max(120), keywords: words })).min(2).max(10),
  concernOptions: z.array(z.object({ label: z.string().min(1).max(60), concerns: z.array(z.string().max(80)).max(10), keywords: words })).max(20),
  goals: z.array(z.object({ label: z.string().min(1).max(60), keywords: words })).max(12),
  steps: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1).max(40), time: z.enum(["am", "pm", "both"]), essential: z.boolean(),
    keywords: words.min(1), exclude: words, categories: z.array(z.string().max(80)).max(20), tip: z.string().max(300), pinned: z.array(z.string().max(100)).max(20),
  })).min(1).max(12),
  alternatives: z.number().int().min(0).max(5),
});

export type RoutineAnswers = {
  skinType: string;
  concerns: string[]; // ConcernOption labels
  goals: string[]; // goal labels
  sensitive: boolean;
  budget: "any" | "low" | "mid" | "high"; // <$20, $20–45, >$45 per product
  length: "essential" | "full";
};

type Candidate = { slug: string; sku: string; name: string; brand: string; category: string; concerns: string[]; tags: string[]; price: number; inStock: boolean; status: string };

const lower = (s: string) => s.toLowerCase();
const has = (name: string, list: string[]) => list.some((k) => name.includes(lower(k)));

/** Picks products for each step. Generic over the product shape so the server can pass its cards. */
export function buildRoutine<T extends Candidate>(cfg: RoutineConfig, a: RoutineAnswers, products: T[]) {
  const type = cfg.skinTypes.find((s) => s.id === a.skinType);
  const concernOpts = cfg.concernOptions.filter((c) => a.concerns.includes(c.label));
  const concernSlugs = new Set(concernOpts.flatMap((c) => c.concerns));
  const concernWords = concernOpts.flatMap((c) => c.keywords);
  const goalWords = cfg.goals.filter((g) => a.goals.includes(g.label)).flatMap((g) => g.keywords);
  const gentle = ["sensitiv", "gentle", "calm", "sooth", "fragrance-free", "tolerance"];
  const inBudget = (p: number) => a.budget === "any" || (a.budget === "low" ? p < 20 : a.budget === "mid" ? p >= 15 && p <= 45 : p >= 35);

  const steps = cfg.steps.filter((s) => a.length === "full" || s.essential);
  const used = new Set<string>();
  return steps.map((step) => {
    const pool = products.filter((p) => {
      if (p.status !== "active" || !p.inStock) return false;
      if (step.categories.length && !step.categories.includes(p.category)) return false;
      const n = lower(`${p.name}`);
      return has(n, step.keywords) && !has(n, step.exclude);
    });
    const score = (p: T) => {
      const n = lower(p.name);
      let s = 0;
      s += p.concerns.filter((c) => concernSlugs.has(c)).length * 3;
      s += concernWords.filter((k) => n.includes(lower(k))).length * 2;
      s += goalWords.filter((k) => n.includes(lower(k))).length * 1.5;
      s += (type?.keywords ?? []).filter((k) => n.includes(lower(k))).length;
      if (a.sensitive || a.skinType === "sensitive") s += gentle.some((k) => n.includes(k)) ? 2 : 0;
      if (p.tags.includes("favorite")) s += 1;
      if (inBudget(p.price)) s += 2;
      else if (a.budget !== "any") s -= 3;
      return s;
    };
    const pinned = step.pinned.map((sku) => products.find((p) => p.sku.toLowerCase() === sku.toLowerCase())).filter((p): p is T => !!p && p.inStock);
    const ranked = [...pinned, ...pool.filter((p) => !pinned.includes(p)).sort((x, y) => score(y) - score(x) || x.price - y.price)];
    const picks: T[] = [];
    for (const p of ranked) {
      if (used.has(p.slug) || picks.some((x) => x.slug === p.slug)) continue;
      picks.push(p);
      if (picks.length > cfg.alternatives) break;
    }
    if (picks[0]) used.add(picks[0].slug);
    return { step, picks };
  });
}
