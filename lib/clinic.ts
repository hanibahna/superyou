// Clinic treatments done with our partner dermatology clinic, sold on SuperYou and booked as a
// request: the date is confirmed by the team on WhatsApp. They come AFTER the home routine: the
// routine prepares and maintains the skin, the treatment does what creams can't.
//
// MOCK-UP: partner name and prices are placeholders until the partnership and price list are agreed.

export const CLINIC = {
  partner: "DermaPro",
  mock: true,
  place: "Partner clinic, Beirut",
  note: "Prices are indicative (mock-up) and confirmed by the clinic after your consultation. Booking dates are confirmed by our team on WhatsApp.",
};

export type Procedure = {
  id: string;
  name: string;
  category: "Consultation" | "Facials & peels" | "Laser & light" | "Collagen & renewal" | "Injectables" | "Hair & body";
  what: string; // what it does, in plain words
  forConcerns: string[]; // keywords matched against the scan's concerns, zones and observations
  routine: string; // where it fits with the home routine (before / after / pause what)
  sessions: string;
  downtime: string;
  minutes: number;
  priceFrom: number; // USD, mock
  order: number; // what comes first when several are suggested (lower = earlier)
};

export const PROCEDURES: Procedure[] = [
  { id: "derm-consult", name: "Dermatologist consultation", category: "Consultation", what: "A doctor examines your skin, confirms your SuperScan reading and builds your treatment plan.", forConcerns: [], routine: "Always first. Bring your SuperScan and the products you use.", sessions: "1", downtime: "None", minutes: 30, priceFrom: 40, order: 0 },
  { id: "hydrafacial", name: "HydraFacial", category: "Facials & peels", what: "Cleans, exfoliates and hydrates in one session; leaves skin clearer and brighter.", forConcerns: ["dull", "pore", "oil", "blackhead", "dehydrat", "dry", "glow"], routine: "Good first treatment. Keep your routine the same day, skip exfoliating acids for 2 days.", sessions: "1 a month", downtime: "None", minutes: 45, priceFrom: 120, order: 1 },
  { id: "medical-facial", name: "Medical facial for acne", category: "Facials & peels", what: "Deep cleansing, extractions and calming masks under medical supervision.", forConcerns: ["acne", "blemish", "spot", "breakout", "comedon", "pore"], routine: "Pause retinoids 3 days before. Restart your acne routine 2 days after.", sessions: "1 every 3–4 weeks", downtime: "Some redness for a few hours", minutes: 60, priceFrom: 80, order: 1 },
  { id: "light-peel", name: "Light chemical peel", category: "Facials & peels", what: "A gentle acid peel that smooths texture, brightens and evens tone.", forConcerns: ["dull", "uneven", "texture", "pigment", "dark spot", "acne", "pore"], routine: "Stop retinol and acids 5 days before. After: gentle cleanser, moisturiser and SPF 50 every day.", sessions: "3–6, every 2–4 weeks", downtime: "Light flaking for 2–4 days", minutes: 30, priceFrom: 90, order: 2 },
  { id: "deep-peel", name: "Medium-depth peel", category: "Facials & peels", what: "A stronger peel for stubborn dark spots and fine lines.", forConcerns: ["pigment", "dark spot", "melasma", "sun", "fine line", "wrinkle"], routine: "Doctor's plan only. Prepare skin 2 weeks with the clinic's products; strict sun protection after.", sessions: "1–2", downtime: "5–7 days of peeling", minutes: 45, priceFrom: 250, order: 4 },
  { id: "microneedling", name: "Microneedling", category: "Collagen & renewal", what: "Tiny needles trigger new collagen to improve scars, pores and fine lines.", forConcerns: ["scar", "pore", "texture", "fine line", "wrinkle"], routine: "Pause retinol 5 days before and after. Only gentle products and SPF for a week.", sessions: "3–4, every 4–6 weeks", downtime: "1–2 days of redness", minutes: 60, priceFrom: 150, order: 3 },
  { id: "rf-microneedling", name: "RF microneedling", category: "Collagen & renewal", what: "Microneedling with radiofrequency heat, for firmer skin and deeper acne scars.", forConcerns: ["scar", "sag", "laxity", "firm", "wrinkle", "pore"], routine: "Pause actives a week around each session; repair cream and SPF after.", sessions: "3, every 4–6 weeks", downtime: "2–3 days of redness", minutes: 60, priceFrom: 300, order: 4 },
  { id: "fractional-laser", name: "Fractional laser resurfacing", category: "Laser & light", what: "Resurfaces the skin for acne scars, deep texture and sun damage.", forConcerns: ["scar", "texture", "sun", "wrinkle", "pigment"], routine: "After a consultation only. Stop retinol 1 week before; barrier repair and SPF 50 for a month after.", sessions: "1–3", downtime: "5–7 days", minutes: 60, priceFrom: 400, order: 5 },
  { id: "ipl", name: "IPL photofacial", category: "Laser & light", what: "Light pulses fade redness, broken veins and sun spots.", forConcerns: ["redness", "rosacea", "vein", "sun", "pigment", "dark spot", "flush"], routine: "No self-tan or sun 2 weeks before. Soothing cream and SPF after.", sessions: "3–5, every 3–4 weeks", downtime: "Spots darken then flake off in a week", minutes: 30, priceFrom: 150, order: 3 },
  { id: "pigment-laser", name: "Pigmentation laser", category: "Laser & light", what: "Targets dark spots and age spots precisely.", forConcerns: ["pigment", "dark spot", "age spot", "melasma", "uneven"], routine: "Keep your brightening serum, pause it 3 days around each session; SPF 50 every day.", sessions: "2–4", downtime: "Small crusts for a week", minutes: 30, priceFrom: 200, order: 4 },
  { id: "blue-light", name: "Blue-light acne therapy", category: "Laser & light", what: "Light that calms acne bacteria and inflammation.", forConcerns: ["acne", "blemish", "breakout", "spot"], routine: "Works alongside your acne routine; no need to stop it.", sessions: "6–8, twice a week", downtime: "None", minutes: 20, priceFrom: 50, order: 2 },
  { id: "laser-veins", name: "Spider veins laser", category: "Laser & light", what: "Closes small visible veins on the face or legs.", forConcerns: ["vein", "redness", "capillar"], routine: "No sun on the area 2 weeks before and after.", sessions: "1–3", downtime: "Light bruising for days", minutes: 30, priceFrom: 150, order: 4 },
  { id: "anti-wrinkle", name: "Anti-wrinkle injections", category: "Injectables", what: "Softens expression lines on the forehead, frown and around the eyes.", forConcerns: ["wrinkle", "fine line", "forehead", "frown", "crow"], routine: "Keep your anti-ageing routine; avoid rubbing the area and workouts for 24 hours.", sessions: "Every 4–6 months", downtime: "None", minutes: 20, priceFrom: 200, order: 5 },
  { id: "fillers", name: "Dermal fillers", category: "Injectables", what: "Restores lost volume in cheeks, lips or deep folds.", forConcerns: ["volume", "fold", "hollow", "sag", "lip"], routine: "No blood-thinning supplements a week before (ask your doctor). Gentle routine for 2 days.", sessions: "Every 9–12 months", downtime: "Swelling for 2–3 days", minutes: 45, priceFrom: 300, order: 6 },
  { id: "skin-boosters", name: "Skin boosters", category: "Injectables", what: "Injected hyaluronic acid that hydrates from inside for a smoother, dewy look.", forConcerns: ["dehydrat", "dry", "dull", "fine line", "crepey"], routine: "Your hydrating routine keeps the effect longer; skip actives for 2 days.", sessions: "2–3, a month apart", downtime: "Small bumps for 1–2 days", minutes: 30, priceFrom: 250, order: 5 },
  { id: "mesotherapy", name: "Mesotherapy", category: "Injectables", what: "Vitamins and actives injected superficially for radiance.", forConcerns: ["dull", "tired", "glow", "dehydrat"], routine: "Keep your routine; skip make-up for 12 hours.", sessions: "3–4, every 2 weeks", downtime: "Tiny marks for a day", minutes: 30, priceFrom: 120, order: 5 },
  { id: "hifu", name: "Non-surgical facelift (HIFU)", category: "Collagen & renewal", what: "Ultrasound that tightens and lifts the jawline and neck.", forConcerns: ["sag", "laxity", "jaw", "firm", "lift"], routine: "No preparation needed; keep your firming routine.", sessions: "1 a year", downtime: "None", minutes: 60, priceFrom: 450, order: 6 },
  { id: "prp-hair", name: "PRP for hair loss", category: "Hair & body", what: "Your own platelet-rich plasma to strengthen thinning hair.", forConcerns: ["hair loss", "thinning"], routine: "Pairs with our hair-loss serums and supplements; no washing for 24 hours.", sessions: "3–4, monthly", downtime: "None", minutes: 45, priceFrom: 200, order: 4 },
  { id: "laser-hair", name: "Laser hair removal", category: "Hair & body", what: "Long-lasting hair reduction on face or body.", forConcerns: ["hair removal", "ingrown"], routine: "Shave the day before, no waxing for 4 weeks, no sun 2 weeks before.", sessions: "6–8, every 4–6 weeks", downtime: "None", minutes: 30, priceFrom: 60, order: 3 },
  { id: "scar-removal", name: "Scar treatment", category: "Collagen & renewal", what: "A combined plan (laser, needling or injections) for acne and surgery scars.", forConcerns: ["scar"], routine: "Planned by the doctor after a consultation.", sessions: "3–6", downtime: "Depends on the plan", minutes: 45, priceFrom: 150, order: 4 },
  { id: "tattoo-removal", name: "Tattoo removal", category: "Hair & body", what: "Laser that breaks up tattoo ink over several sessions.", forConcerns: ["tattoo"], routine: "Keep the area moisturised and out of the sun.", sessions: "6–10", downtime: "Blisters for a few days", minutes: 30, priceFrom: 100, order: 5 },
];

export const getProcedure = (id: string) => PROCEDURES.find((p) => p.id === id);

/** After a SuperScan: up to 3 treatments that complete the routine, in the order to do them, the consultation first. */
export function treatmentsFor(a: { concerns: string[]; observations?: string[]; zones?: { note: string }[]; sensitive?: boolean; redFlags?: string[] }): Procedure[] {
  const hay = [...a.concerns, ...(a.observations ?? []), ...(a.zones ?? []).map((z) => z.note)].join(" ").toLowerCase();
  const scored = PROCEDURES.filter((p) => p.forConcerns.length)
    .map((p) => ({ p, s: p.forConcerns.filter((k) => hay.includes(k)).length }))
    .filter((x) => x.s > 0)
    .filter((x) => !(a.sensitive && ["deep-peel", "fractional-laser"].includes(x.p.id))) // gentler options for easily irritated skin
    .sort((x, y) => y.s - x.s || x.p.order - y.p.order)
    .slice(0, 3)
    .map((x) => x.p)
    .sort((x, y) => x.order - y.order);
  if (!scored.length) return [];
  return [getProcedure("derm-consult")!, ...scored];
}

export const publicProcedure = (p: Procedure) => ({ id: p.id, name: p.name, category: p.category, what: p.what, routine: p.routine, sessions: p.sessions, downtime: p.downtime, minutes: p.minutes, priceFrom: p.priceFrom });
