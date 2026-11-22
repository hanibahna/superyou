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
  const ck = `yt:v1:${p.slug}`;
  const hit = await db.cmd<string | null>(["GET", ck]).catch(() => null);
  if (hit) return JSON.parse(hit) as YtVideo[];
  const q = `${p.brand} ${p.name.replace(/\b\d+\s?(ml|g|gr|oz|pcs)\b/gi, "")} review how to use`.replace(/\s+/g, " ").trim();
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=6&videoEmbeddable=true&safeSearch=strict&relevanceLanguage=en&q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r?.ok) {
    if (r) console.error("[youtube]", r.status, (await r.text().catch(() => "")).slice(0, 300));
    return [];
  }
  const j = (await r.json()) as { items?: { id: { videoId: string }; snippet: { title: string; channelTitle: string } }[] };
  const brand = p.brand.toLowerCase().split(/\s+/)[0];
  const words = p.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  // Keep videos that name the brand and at least one word of the product, so we don't show unrelated clips.
  const out = (j.items ?? [])
    .map((i) => ({ id: i.id.videoId, title: decode(i.snippet.title), channel: decode(i.snippet.channelTitle) }))
    .filter((v) => { const t = v.title.toLowerCase(); return t.includes(brand) && (!words.length || words.some((w) => t.includes(w))); })
    .slice(0, 3);
  await db.cmd(["SET", ck, JSON.stringify(out), "EX", String(out.length ? 30 * 86400 : 7 * 86400)]).catch(() => {});
  return out;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
