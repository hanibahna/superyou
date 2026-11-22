import "server-only";

import { db } from "@/lib/db";
import { getExtras } from "@/lib/extras";

// YouTube videos for product pages: the YouTube Data API finds review / how-to videos for the
// product (strict SafeSearch, embeddable only). Results are cached 30 days per product because each
// search uses 100 of the 10,000 free daily quota units. Admin pins or hides per product.
export type YtVideo = { id: string; title: string; channel: string };

export async function videosForProduct(p: { slug: string; brand: string; name: string }): Promise<YtVideo[]> {
  const cfg = (await getExtras()).youtube;
  if (!cfg.enabled) return [];
  const pin = cfg.pins[p.slug];
  if (pin === "none") return [];
  if (pin) return [{ id: pin, title: `${p.brand} ${p.name}`, channel: "" }];
  const key = cfg.key || process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const ck = `yt:v2:${p.slug}`;
  const hit = await db.cmd<string | null>(["GET", ck]).catch(() => null);
  if (hit) return JSON.parse(hit) as YtVideo[];
  const clean = p.name.replace(/\b\d+([.,]\d+)?\s?(ml|g|gr|oz|pcs|mcg|mg|caps?|tabs?|x)\b/gi, "").replace(/[()|,+]/g, " ").replace(/\s+/g, " ").trim();
  const brandWords = p.brand.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const nameWords = clean.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !brandWords.includes(w));
  // A video counts when its title names the brand or at least two words of the product.
  const fits = (t: string) => { const x = t.toLowerCase(); const named = nameWords.filter((w) => x.includes(w)).length; return (brandWords.some((w) => x.includes(w)) && (named >= 1 || !nameWords.length)) || named >= 2; };
  const out: YtVideo[] = [];
  for (const q of [`${p.brand} ${clean} review how to use`, `${p.brand} ${clean}`]) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&videoEmbeddable=true&safeSearch=strict&q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!r?.ok) {
      if (r) console.error("[youtube]", r.status, (await r.text().catch(() => "")).slice(0, 300));
      return out; // don't cache failures (quota, key problems): try again later
    }
    const j = (await r.json()) as { items?: { id: { videoId: string }; snippet: { title: string; channelTitle: string } }[] };
    for (const i of j.items ?? []) {
      const v = { id: i.id.videoId, title: decode(i.snippet.title), channel: decode(i.snippet.channelTitle) };
      if (fits(v.title) && !out.some((x) => x.id === v.id)) out.push(v);
    }
    if (out.length >= 2) break;
  }
  const keep = out.slice(0, 3);
  await db.cmd(["SET", ck, JSON.stringify(keep), "EX", String(keep.length ? 30 * 86400 : 3 * 86400)]).catch(() => {});
  return keep;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
