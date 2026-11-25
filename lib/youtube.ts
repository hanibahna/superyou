import { fullName } from "@/lib/data/catalog";
import "server-only";

import { db } from "@/lib/db";
import { getExtras } from "@/lib/extras";

// YouTube videos for product pages: the YouTube Data API finds review / how-to videos for the
// product (strict SafeSearch, embeddable only). Results are cached 30 days per product because each
// search uses 100 of the 10,000 free daily quota units. Admin pins or hides per product.
export type YtVideo = { id: string; title: string; channel: string; lang?: string; related?: boolean };
export const VIDEO_LANGS = ["en", "fr", "ar"] as const;

export async function videosForProduct(p: { slug: string; brand: string; name: string }, trace?: string[]): Promise<YtVideo[]> {
  const cfg = (await getExtras()).youtube;
  if (!cfg.enabled) { trace?.push("youtube switched off in admin"); return []; }
  const pin = cfg.pins[p.slug];
  if (pin === "none") return [];
  if (pin) return [{ id: pin, title: `${fullName(p.brand, p.name)}`, channel: "" }];
  const key = cfg.key || process.env.YOUTUBE_API_KEY;
  if (!key) { trace?.push("no key"); return []; }
  const ck = `yt:v7:${p.slug}`;
  const hit = await db.cmd<string | null>(["GET", ck]).catch(() => null);
  if (hit && !trace) return JSON.parse(hit) as YtVideo[];
  // Videos found before any-language search: keep them (an empty v6 result is searched again).
  const old = await db.cmd<string | null>(["GET", `yt:v6:${p.slug}`]).catch(() => null);
  if (old && old !== "[]" && !trace) return JSON.parse(old) as YtVideo[];
  let out: YtVideo[] = [];
  let apiFailed = false;
  const cands: (YtVideo & { desc: string; hint: string; from: string })[] = [];
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
  // Arabic and French titles often name the product in Latin letters but with fewer of its words:
  // for those, the brand plus the product line is enough here, and Claude's check decides.
  const loose = (title: string, desc: string) => { const t = words(`${title} ${desc.slice(0, 200)}`); return brandWords.some((w) => t.includes(w)) && nameWords.slice(0, 2).every((w) => t.includes(w)) && !MULTI.test(title); };
  // One search per language: English, French, Arabic only.
  // English first; French and Arabic only when English found too little (saves 2 of 3 searches on most products).
  // Last: any language (captions can be translated in the player).
  for (const [lang, extra] of [["en", "review"], ["fr", "avis"], ["ar", "مراجعة"], ["any", ""]] as const) {
    if (lang !== "en" && cands.length >= 3) break;
    const rl = lang === "any" ? "" : `&relevanceLanguage=${lang}`;
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&videoEmbeddable=true&safeSearch=strict${rl}&q=${encodeURIComponent(`${short} ${extra}`.trim())}&key=${encodeURIComponent(key)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!r?.ok) {
      const e = r ? `${r.status} ${(await r.text().catch(() => "")).slice(0, 300)}` : "no response";
      console.error("[youtube]", e); trace?.push(`search failed: ${e}`);
      apiFailed = true; // daily search allowance used up (or key problem): Claude's web search takes over below
      break;
    }
    const j = (await r.json()) as { items?: { id: { videoId: string }; snippet: { title: string; channelTitle: string; description?: string } }[] };
    for (const i of j.items ?? []) {
      const v = { id: i.id.videoId, title: decode(i.snippet.title), channel: decode(i.snippet.channelTitle), desc: decode(i.snippet.description ?? ""), hint: lang as string, from: lang as string };
      // Shop names often add a description ("for Dark Circles") the video title leaves out: brand +
      // product line is enough to reach Claude's check, which decides on the exact product.
      const f = fits(v.title, v.channel) || loose(v.title, v.desc);
      trace?.push(`[${lang}] ${f ? "PASS" : "drop"}: ${v.title} — ${v.channel}`);
      if (f && !cands.some((x) => x.id === v.id)) cands.push(v);
    }
  }
  // The language the video is spoken in, as YouTube records it (1 quota unit for all of them).
  if (cands.length) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${cands.map((c) => c.id).join(",")}&key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    const j = r?.ok ? ((await r.json()) as { items?: { id: string; snippet: { defaultAudioLanguage?: string; defaultLanguage?: string } }[] }) : {};
    for (const it of j.items ?? []) { const c = cands.find((x) => x.id === it.id); const l = (it.snippet.defaultAudioLanguage || it.snippet.defaultLanguage || "").slice(0, 2).toLowerCase(); if (c && l) c.hint = `${l} (YouTube)`; }
  }
  // Second check: Claude keeps only videos about exactly this product, spoken in English, French or Arabic.
  // Up to 4 candidates from each language's search, so English results don't crowd out the others.
  const pick = ["en", "fr", "ar", "any"].flatMap((l) => cands.filter((c) => c.from === l).slice(0, 4));
  const ok = await confirmSameProduct(p, pick);
  trace?.push(`words: ${nameWords.join(",")} | claude kept: ${[...ok].map(([id, l]) => `${id}:${l}`).join(",") || "none"} | ${lastCheck}`);
  const per: Record<string, number> = {};
  for (const v of cands) {
    const l = ok.get(v.id);
    if (!l || (per[l] ?? 0) >= 2) continue;
    per[l] = (per[l] ?? 0) + 1;
    out.push({ id: v.id, title: v.title, channel: v.channel, lang: l });
  }
  // Nothing from YouTube's own search (allowance used up, or no exact match): Claude searches the web
  // for YouTube videos of the product, then for related ones (same range / brand how-to).
  if (out.length < 1) {
    const more = await findWithClaude(p, key, trace);
    out = [...out, ...more.filter((m) => !out.some((o) => o.id === m.id))];
  }
  const rank = (l?: string) => { const i = (VIDEO_LANGS as readonly string[]).indexOf(l ?? ""); return i < 0 ? 9 : i; };
  out.sort((a, b) => Number(!!a.related) - Number(!!b.related) || rank(a.lang) - rank(b.lang));
  // A failed search that found nothing isn't remembered, so the next visit tries again.
  if (apiFailed && !out.length) return out;
  await db.cmd(["SET", ck, JSON.stringify(out), "EX", String(out.length ? 30 * 86400 : 7 * 86400)]).catch(() => {});
  return out;
}

/** Fallback without YouTube's search allowance: Claude's web search finds YouTube videos of the
 * product (or, failing that, closely related ones); YouTube's video lookup (1 unit, separate
 * allowance) confirms each one exists and can be played on other sites. */
async function findWithClaude(p: { brand: string; name: string }, ytKey: string, trace?: string[]): Promise<YtVideo[]> {
  const { anthropicKey } = await import("@/lib/extras");
  const key = await anthropicKey();
  if (!key) return [];
  const product = fullName(p.brand, p.name);
  const prompt = `Find YouTube videos about this product: "${product}".
Search YouTube pages on the web (reviews, how to use, demos, before/after) in any language.
First look for videos about EXACTLY this product (same brand, line and variant). If there are fewer than 2, also add up to 3 closely related videos: the same product line, or the brand's own how-to for this type of product. No hauls, "top 10" lists, dupes, or unrelated products.
Reply with JSON only: [{"url":"https://www.youtube.com/watch?v=...","lang":"two-letter code of the spoken language","exact":true|false}] (max 6). Reply [] if none.`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_PRESS_MODEL || "claude-sonnet-5-5", max_tokens: 1500, tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }], messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(50_000),
  }).catch(() => null);
  if (!r?.ok) { trace?.push(`claude search failed: ${r?.status ?? "no response"}`); return []; }
  const j = (await r.json().catch(() => ({}))) as { content?: { type: string; text?: string; content?: { url?: string }[] }[] };
  const idOf = (u: string) => u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1];
  // Only videos whose pages the search really returned.
  const seen = new Set<string>();
  for (const c of j.content ?? []) if (c.type === "web_search_tool_result" && Array.isArray(c.content)) for (const x of c.content) { const id = x.url && idOf(x.url); if (id) seen.add(id); }
  const text = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  let picks: { id: string; lang: string; exact: boolean }[] = [];
  try {
    const raw = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as { url?: string; lang?: string; exact?: boolean }[];
    for (const x of raw) { const id = idOf(String(x.url ?? "")); if (id && seen.has(id) && !picks.some((y) => y.id === id)) picks.push({ id, lang: String(x.lang ?? "").slice(0, 2).toLowerCase(), exact: !!x.exact }); }
  } catch {}
  trace?.push(`claude found: ${picks.map((x) => `${x.id}:${x.lang}:${x.exact ? "exact" : "related"}`).join(",") || "none"} (seen ${seen.size})`);
  if (!picks.length) return [];
  picks = picks.slice(0, 6);
  // Confirm on YouTube: exists, public, embeddable; real title and channel.
  const v = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${picks.map((x) => x.id).join(",")}&key=${encodeURIComponent(ytKey)}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!v?.ok) { trace?.push(`video lookup failed: ${v?.status ?? "no response"}`); return []; }
  const vj = (await v.json()) as { items?: { id: string; snippet: { title: string; channelTitle: string; defaultAudioLanguage?: string }; status: { embeddable?: boolean; privacyStatus?: string } }[] };
  const out: YtVideo[] = [];
  for (const x of picks) {
    const it = vj.items?.find((i) => i.id === x.id);
    if (!it || it.status.embeddable === false || it.status.privacyStatus !== "public") continue;
    out.push({ id: x.id, title: decode(it.snippet.title), channel: decode(it.snippet.channelTitle), lang: (it.snippet.defaultAudioLanguage || x.lang || "").slice(0, 2).toLowerCase() || undefined, ...(x.exact ? {} : { related: true }) });
  }
  return out.slice(0, 5);
}

export let lastCheck = "";
/** Asks Claude which videos are specifically about this exact product, and in which language
 * (English, French or Arabic only). No key = nothing passes. */
async function confirmSameProduct(p: { brand: string; name: string }, vids: { id: string; title: string; channel: string; desc: string; hint: string }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!vids.length) return out;
  const { anthropicKey } = await import("@/lib/extras");
  const key = await anthropicKey();
  if (!key) return out;
  const list = vids.map((v, i) => `${i + 1}. id=${v.id}\ntitle: ${v.title}\nchannel: ${v.channel}\nlanguage hint: ${v.hint}\ndescription: ${v.desc.slice(0, 300)}`).join("\n\n");
  const prompt = `Product sold on our shop: "${fullName(p.brand, p.name)}".

For each YouTube video below, decide:
1. Is it specifically about EXACTLY this product: same brand, same product line and same variant (a different shade family, formula, SPF, "night" vs "day", "serum" vs "cream", or another product of the same range is NOT the same)? Reject comparisons, routines, hauls, lists of several products, dupes and videos where the product is only mentioned. When unsure, reject.
2. Which language is it spoken in? Any language is allowed. Give its two-letter ISO 639-1 code (en, fr, ar, es, pt, ko, it, de…). Judge from the title, description, channel and the language hint.

Reply with one line per accepted video, exactly "id lang", for example:
Rx4tU0SBJyM en
Reply NONE if no video passes. No other text.

${list}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_TRANSLATE_MODEL || "claude-haiku-5-5", max_tokens: 3000, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(25_000),
  }).catch(() => null);
  if (!r?.ok) { lastCheck = r ? `error ${r.status}` : "no response"; return out; }
  const j = (await r.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; stop_reason?: string };
  const text = (j.content ?? []).map((c) => c.text ?? "").join(" ");
  lastCheck = `${j.stop_reason}: ${text.slice(0, 300)}`;
  const ids = new Set(vids.map((v) => v.id));
  for (const m of text.matchAll(/([A-Za-z0-9_-]{11})\s+([a-z]{2})\b/g)) if (ids.has(m[1])) out.set(m[1], m[2]);
  return out;
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
    if (await db.cmd<number>(["EXISTS", `yt:v7:${p.slug}`]).catch(() => 1)) continue;
    await videosForProduct({ slug: p.slug, brand: p.brand, name: p.name });
    done++;
  }
  return done;
}


/** Videos already found for a product (no YouTube call): for page structured data. */
export async function cachedVideos(slug: string): Promise<YtVideo[]> {
  const hit = (await db.cmd<string | null>(["GET", `yt:v7:${slug}`]).catch(() => null)) ?? (await db.cmd<string | null>(["GET", `yt:v6:${slug}`]).catch(() => null));
  return hit ? (JSON.parse(hit) as YtVideo[]) : [];
}
