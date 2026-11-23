import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { limited } from "@/lib/ratelimit";
import { checkIn } from "@/lib/game";
import { getGrowth } from "@/lib/growth-store";

// App: daily pharmacist tip. Opening it once a day builds a streak; a full streak earns Club points (members only).
const TIPS = [
  "Apply sunscreen as the last step of your morning routine, and reapply every 2 hours outdoors.",
  "Use about two finger-lengths of sunscreen for the face and neck.",
  "Introduce one new active (retinol, acids, vitamin C) at a time, two weeks apart.",
  "Retinol goes on at night, on dry skin. Start 2–3 nights a week.",
  "Vitamin C in the morning, under sunscreen, boosts protection against pollution.",
  "Double cleanse at night if you wear sunscreen or make-up: oil or balm first, then a gentle cleanser.",
  "Apply serums on slightly damp skin, then seal with a moisturiser.",
  "Oily skin still needs moisturiser: choose a light gel labelled non-comedogenic.",
  "Change your pillowcase twice a week if you're prone to breakouts.",
  "Don't mix strong acids and retinol on the same night unless a pharmacist advises it.",
  "Patch-test new products behind the ear or on the inner arm for 48 hours.",
  "Lips need SPF too: use a lip balm with SPF 30 or more.",
  "Niacinamide calms redness and helps oily skin; it pairs well with most products.",
  "Hyaluronic acid draws water into the skin; follow it with a cream to keep it there.",
  "Pregnant or breastfeeding? Ask a pharmacist before using retinoids or high-dose acids.",
  "Wash make-up brushes weekly with mild shampoo to keep bacteria away.",
  "Exfoliate 1–3 times a week, not every day.",
  "Sunscreen expires: check the date and replace opened bottles after 12 months.",
  "For dandruff, leave the medicated shampoo on the scalp for 3–5 minutes before rinsing.",
  "Drink water, but skin hydration comes mostly from what you put on it: use a good moisturiser.",
  "Under-eye skin is thin: tap eye cream on with your ring finger.",
  "Supplements are not a substitute for a varied diet. Ask a pharmacist before combining several.",
  "Keep vitamin C serums in a cool, dark place: they lose strength in heat and light.",
  "Shave with the grain and use a clean blade to avoid ingrown hairs.",
  "Kids' sunscreen: choose mineral filters (zinc oxide, titanium dioxide) for sensitive skin.",
  "Dry hands in winter? Apply hand cream after every wash, and wear gloves outdoors.",
  "Acne patches work best on spots that have come to a head.",
  "Store perfume away from sunlight and heat to keep it smelling true.",
  "Fragrance-free is gentler for sensitive and eczema-prone skin.",
  "Not sure what your skin needs? Take a free SuperScan in the app.",
];

export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "checkin", 20);
  if (tooMany) return tooMany;
  const p = z.object({ phone: z.string().max(30).optional().default("") }).safeParse(await req.json().catch(() => ({})));
  const g = await getGrowth();
  const day = Math.floor((Date.now() + 2 * 3600_000) / 864e5);
  const tip = TIPS[day % TIPS.length];
  if (!g.game.enabled || !g.game.checkin.enabled) return NextResponse.json({ tip, streak: null });
  const st = p.success && p.data.phone ? await checkIn(p.data.phone) : null;
  return NextResponse.json({ tip, streak: st, days: g.game.checkin.days, points: g.game.checkin.points });
}
