import "server-only";

import { db } from "@/lib/db";
import { getExtras } from "@/lib/extras";

// YouTube videos for product pages: the YouTube Data API finds review / how-to videos for the
// product (strict SafeSearch, embeddable only). Results are cached 30 days per product because each
// search uses 100 of the 10,000 free daily quota units. Admin pins or hides per product.
export type YtVideo = { id: string; title: string; channel: string };

export async function videosForProduct(p: { slug: string; brand: string; name: string }, trace?: string[]): Promise<YtVideo[]> {
  const cfg = (await getExtras()).youtube;
  if (!cfg.enabled) { trace?.push("youtube switched off in admin"); return []; }
  const pin = cfg.pins[p.slug];
  if (pin === "none") return [];
  if (pin) return [{ id: pin, title: `${p.brand} ${p.name}`, channel: "" }];
  const key = cfg.key || process.env.YOUTUBE_API_KEY;
  if (!key) { trace?.push("no key"); return []; }
  const ck = `yt:v4:${p.slug}`;
  const hit = await db.cmd<string | null>(["GET", ck]).catch(() => null);
  if (hit && !trace) return JSON.parse(hit) as YtVideo[];
  const out: YtVideo[] = [];
  const cands: (YtVideo & { desc: string })[] = [];
  const words = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  const clean = p.name.replace(/\b\d+([.,]\d+)?\s?(ml|g|gr|oz|pcs|mcg|mg|caps?|tabs?|x|iu|kg|l)\b/gi, "").replace(/[()|,+]/g, " ").replace(/\s+/g, " ").trim();
  const brandWords = words(p.brand).filter((w) => w.length > 1);
  const FILLER = new Set(["for", "with", "and", "the", "de", "la", "le", "les", "des", "et", "pour", "avec", "a", "of", "in", "to", "new", "skin", "all", "types", "type", "pack", "refill", "travel", "size", "mini", "spray", "tube", "jar", "bottle", "pump", "oily", "dry", "combination", "sensitive", "normal", "prone", "acne", "face", "facial", "body", "women", "men", "adults", "adult", "kids", "daily", "care"]);
  const nameWords = words(clean).filter((w) => !brandWords.includes(w) && !FILLER.has(w) && (w.length > 2 || /\d/.test(w)));
  // Strict: the title names the brand AND every distinctive word of the product name (same line, same
  // variant), and it is not a comparison, list, haul or "dupe" video about several products.
  const MULTI = /\bvs\.?\b|versus|\btop ?\d+|\bbest\b|haul|dupe|alternative|empties|favou?rites|routine|compar|ranking|ranked|every |all the |which is better|drugstore|cheap|tier list|unboxing|giveaway|#shorts/i;
  const fits = (title: string, channel: string) => {
    const t = words(title), c = words(channel);
    const hasBrand = brandWords.length > 0 && brandWords.every((w) => t.includes(w) || c.includes(w)) && brandWords.some((w) => t.includes(w));
    // The product line (first distinctive words of the name) must all be there; with the rest, most of them.
    const inT = (w: string) => t.includes(w) || t.some((x) => x.length > 4 && (x.startsWith(w) || w.startsWith(x)));
    const line = nameWords.slice(0, 2);
    const hits = nameWords.filter(inT).length;
    const hasAll = nameWords.length > 0 && line.every(inT) && hits >= Math.min(nameWords.length, Math.max(2, Math.ceil(nameWords.length * 0.6)));
    return hasBrand && hasAll && !MULTI.test(title);
  };
  const short = `${p.brand} ${nameWords.slice(0, 4).join(" ")}`;
  for (const q of [`${short} review`, `${p.brand} ${clean}`]) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&videoEmbeddable=true&safeSearch=strict&q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!r?.ok) {
      const e = r ? `${r.status} ${(await r.text().catch(() => "")).slice(0, 300)}` : "no response";
      console.error("[youtube]", e); trace?.push(`search failed: ${e}`);
      return out; // don't cache failures (quota, key problems): try again later
    }
    const j = (await r.json()) as { items?: { id: { videoId: string }; snippet: { title: string; channelTitle: string; description?: string } }[] };
    for (const i of j.items ?? []) {
      const v = { id: i.id.videoId, title: decode(i.snippet.title), channel: decode(i.snippet.channelTitle), desc: decode(i.snippet.description ?? "") };
      const f = fits(v.title, v.channel);
      trace?.push(`${f ? "PASS" : "drop"}: ${v.title} — ${v.channel}`);
      if (f && !cands.some((x) => x.id === v.id)) cands.push(v);
    }
    if (cands.length >= 3) break;
  }
  // Second check: Claude reads each candidate and keeps it only if it is about exactly this product.
  const ok = await confirmSameProduct(p, cands.slice(0, 5));
  trace?.push(`words: ${nameWords.join(",")} | claude kept: ${[...ok].join(",") || "none"} | ${lastCheck}`);
  for (const v of cands) if (ok.has(v.id) && out.length < 3) out.push({ id: v.id, title: v.title, channel: v.channel });
  await db.cmd(["SET", ck, JSON.stringify(out), "EX", String(out.length ? 30 * 86400 : 7 * 86400)]).catch(() => {});
  return out;
}

export let lastCheck = "";
/** Asks Claude whether each video is specifically about this exact product. No key = nothing passes. */
async function confirmSameProduct(p: { brand: string; name: string }, vids: { id: string; title: string; channel: string; desc: string }[]): Promise<Set<string>> {
  if (!vids.length) return new Set();
  const { anthropicKey } = await import("@/lib/extras");
  const key = await anthropicKey();
  if (!key) return new Set();
  const list = vids.map((v, i) => `${i + 1}. id=${v.id}\ntitle: ${v.title}\nchannel: ${v.channel}\ndescription: ${v.desc.slice(0, 300)}`).join("\n\n");
  const prompt = `Product sold on our shop: "${p.brand} ${p.name}".\n\nFor each YouTube video below, decide if it is specifically about EXACTLY this product: same brand, same product line and same variant (for example, a different shade family, formula, SPF, "night" vs "day", "serum" vs "cream", or another product of the same range is NOT the same). Reject comparisons, routines, hauls, lists of several products, dupes and videos where the product is only mentioned. When unsure, reject.\n\n${list}\n\nReply with only the ids that are exactly this product, comma-separated, or NONE.`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_TRANSLATE_MODEL || "claude-haiku-5-5", max_tokens: 800, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!r?.ok) { lastCheck = r ? `error ${r.status}` : "no response"; return new Set(); }
  const j = (await r.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; stop_reason?: string };
  const text = (j.content ?? []).map((c) => c.text ?? "").join(" ");
  lastCheck = `${j.stop_reason}: ${text.slice(0, 300)}`;
  return new Set(vids.map((v) => v.id).filter((id) => text.includes(id)));
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Daily: find videos ahead of time for products nobody has opened yet, bestsellers first. Stays well
 * inside YouTube's free daily allowance, leaving room for pages shoppers open during the day. */
export async function prefillVideos(limit = 40) {
  const cfg = (await getExtras()).youtube;
  if (!cfg.enabled || !(cfg.key || process.env.YOUTUBE_API_KEY)) return 0;
  const { liveProducts } = await import("@/lib/pricing");
  const list = (await liveProducts()).list
    .filter((p) => p.inStock && p.status !== "draft")
    .sort((a, b) => Number(b.tags.includes("favorite")) - Number(a.tags.includes("favorite")) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
  let done = 0;
  for (const p of list) {
    if (done >= limit) break;
    if (cfg.pins[p.slug]) continue;
    if (await db.cmd<number>(["EXISTS", `yt:v4:${p.slug}`]).catch(() => 1)) continue;
    await videosForProduct({ slug: p.slug, brand: p.brand, name: p.name });
    done++;
  }
  return done;
}
