import "server-only";

import { db } from "@/lib/db";
import { fullName } from "@/lib/data/catalog";

// Expert reviews of a product from leading beauty and health publications, found with Claude's web
// search (limited to the sites below) the first time a product page is opened, then cached.
// Summaries are written in our own words (one or two sentences); the full review stays on its site.
export type PressReview = { site: string; title: string; url: string; summary: string; verdict?: string; date?: string };

export const PRESS_SITES: Record<string, string> = {
  "allure.com": "Allure", "byrdie.com": "Byrdie", "vogue.com": "Vogue", "vogue.co.uk": "British Vogue", "vogue.fr": "Vogue France",
  "vogue.me": "Vogue Arabia", "elle.com": "ELLE", "elle.fr": "ELLE France", "ellearabia.com": "ELLE Arabia", "harpersbazaar.com": "Harper's Bazaar",
  "harpersbazaararabia.com": "Harper's Bazaar Arabia", "cosmopolitan.com": "Cosmopolitan", "glamour.com": "Glamour", "glamourmagazine.co.uk": "Glamour UK",
  "instyle.com": "InStyle", "marieclaire.com": "Marie Claire", "marieclaire.fr": "Marie Claire France", "refinery29.com": "Refinery29",
  "goodhousekeeping.com": "Good Housekeeping", "womenshealthmag.com": "Women's Health", "menshealth.com": "Men's Health", "health.com": "Health",
  "healthline.com": "Healthline", "self.com": "SELF", "newbeauty.com": "NewBeauty", "people.com": "People", "nytimes.com": "The New York Times / Wirecutter",
  "gq.com": "GQ", "esquire.com": "Esquire", "telegraph.co.uk": "The Telegraph", "theguardian.com": "The Guardian", "independent.co.uk": "The Independent",
};

const siteOf = (url: string) => {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return Object.keys(PRESS_SITES).find((d) => h === d || h.endsWith(`.${d}`)) ?? null;
  } catch { return null; }
};

export async function pressReviews(p: { slug: string; brand: string; name: string }, trace?: string[]): Promise<PressReview[]> {
  const ck = `press:v1:${p.slug}`;
  const hit = await db.cmd<string | null>(["GET", ck]).catch(() => null);
  if (hit && !trace) return JSON.parse(hit) as PressReview[];
  const { anthropicKey } = await import("@/lib/extras");
  const key = await anthropicKey();
  if (!key) return [];
  // One search at a time per product (two shoppers opening the same page don't both pay for it).
  if (!trace && !(await db.cmd<string | null>(["SET", `${ck}:lock`, "1", "NX", "EX", "120"]).catch(() => "OK"))) return [];
  const product = fullName(p.brand, p.name);
  const prompt = `Find published reviews or editorial write-ups of this exact product: "${product}".
Only use articles from these publications: ${Object.values(PRESS_SITES).join(", ")}. Search for the product name together with publication names (for example "${product} review Allure", "${product} Byrdie", "${product} Vogue").
Keep an article only if it reviews or clearly recommends THIS exact product (same brand, same product line and variant). A list article ("best eye creams") counts only if it has a section on this exact product. Skip anything about a different product of the same range.

Reply with JSON only, no other text: an array (max 6) of objects:
{"url": "...", "title": "article title", "summary": "1-2 sentences in your own words on what the reviewer said about this product (no quotes, max 40 words)", "verdict": "Loved it" | "Recommended" | "Mixed" | "Not recommended", "date": "YYYY-MM or empty"}
Reply [] if none.`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_PRESS_MODEL || "claude-sonnet-5-5",
      max_tokens: 2000,
      // No domain filter on the search itself (several publishers can't be named there); results are
      // kept only when they come from the publications above.
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(55_000),
  }).catch(() => null);
  if (!r?.ok) {
    const e = r ? `${r.status} ${(await r.text().catch(() => "")).slice(0, 500)}` : "no response";
    console.error("[press]", e); trace?.push(e);
    await db.cmd(["DEL", `${ck}:lock`]).catch(() => {});
    return [];
  }
  const j = (await r.json().catch(() => ({}))) as { content?: { type: string; text?: string; content?: { url?: string }[] }[] };
  // Only links the search actually returned (never a made-up address).
  const seen = new Set<string>();
  for (const c of j.content ?? []) if (c.type === "web_search_tool_result" && Array.isArray(c.content)) for (const x of c.content) if (x.url) seen.add(x.url.replace(/[#?].*$/, "").replace(/\/$/, ""));
  const text = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  trace?.push(`found: ${[...seen].slice(0, 20).join(" ")}`, `answer: ${text.slice(0, 1500)}`);
  let list: PressReview[] = [];
  try {
    const raw = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as Partial<PressReview>[];
    const urls = new Set<string>();
    for (const x of raw) {
      const url = String(x.url ?? "");
      const d = siteOf(url);
      const norm = url.replace(/[#?].*$/, "").replace(/\/$/, "");
      if (!d || !seen.has(norm) || urls.has(norm)) continue;
      urls.add(norm);
      list.push({ site: PRESS_SITES[d], url, title: String(x.title ?? "").slice(0, 160), summary: String(x.summary ?? "").slice(0, 300), verdict: x.verdict ? String(x.verdict).slice(0, 20) : undefined, date: x.date ? String(x.date).slice(0, 7) : undefined });
    }
  } catch { list = []; }
  list = list.slice(0, 6);
  await db.cmd(["SET", ck, JSON.stringify(list), "EX", String(list.length ? 30 * 86400 : 7 * 86400)]).catch(() => {});
  return list;
}
