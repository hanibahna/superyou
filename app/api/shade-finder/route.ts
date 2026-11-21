import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { toCards } from "@/lib/listing";
import { liveProducts } from "@/lib/pricing";

// Foundation finder: finish, coverage and skin type pick the formulas; depth and undertone give
// the shade range to look for on each product page.
const schema = z.object({
  depth: z.enum(["fair", "light", "medium", "tan", "deep"]),
  undertone: z.enum(["cool", "neutral", "warm", "olive"]),
  finish: z.enum(["matte", "natural", "dewy"]),
  coverage: z.enum(["light", "medium", "full"]),
  skin: z.enum(["oily", "dry", "combination", "normal"]),
});

const BASE = ["foundation", "fond de teint", "skin tint", "bb cream", "cc cream", "teint", "tinted"];
const WORDS = {
  matte: ["matte", "mat ", "matt", "oil-free", "poreless"], natural: ["natural", "nude", "skin", "satin", "second skin"], dewy: ["glow", "radian", "lumin", "dewy", "illumin"],
  light: ["tint", "bb", "cc", "light", "sheer"], medium: ["medium", "buildable"], full: ["full", "cover", "couvrance", "long wear", "24h", "stay"],
  oily: ["matte", "oil", "long wear", "24h"], dry: ["hydra", "glow", "serum", "moist"], combination: ["balanc", "natural", "satin"], normal: [],
};

export async function POST(req: NextRequest) {
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Please answer every question" }, { status: 400 });
  const a = p.data;
  const live = await liveProducts();
  const cards = toCards(live.list).filter((c) => c.inStock && BASE.some((w) => c.name.toLowerCase().includes(w)) && !/brush|sponge|primer|remover|powder brush/i.test(c.name));
  const score = (n: string) => {
    const s = n.toLowerCase();
    return [WORDS[a.finish], WORDS[a.coverage], WORDS[a.skin]].reduce((t, list, i) => t + (list.some((w) => s.includes(w)) ? 3 - i : 0), 0);
  };
  const picks = cards.map((c) => ({ c, s: score(c.name) + (c.variantCount > 4 ? 1 : 0) })).sort((x, y) => y.s - x.s || x.c.price - y.c.price).slice(0, 12).map((x) => x.c);
  const range = { fair: "000–010 / 1N–1W (fair, porcelain, ivory)", light: "010–030 / 2N–2W (light, beige)", medium: "030–050 / 3N–4W (medium, sand, honey)", tan: "050–070 / 5N–6W (tan, caramel)", deep: "070+ / 7N–9W (deep, espresso)" }[a.depth];
  const tone = { cool: "C, P or R (cool, pink, rosy)", neutral: "N (neutral)", warm: "W, Y or G (warm, yellow, golden)", olive: "O or neutral-warm (olive)" }[a.undertone];
  return NextResponse.json({ advice: { range, tone }, picks });
}
