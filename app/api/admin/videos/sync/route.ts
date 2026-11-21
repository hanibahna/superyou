import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getTaxonomy, getIndex } from "@/lib/catalog";
import { newId, type VideoItem } from "@/lib/site";
import { getVideoLibrary, saveVideoLibrary } from "@/lib/site-store";
import { suggestTags } from "@/lib/video-tags";

// Pulls the latest videos from connected YouTube channels (public feed, no API key needed)
// and tags them to categories/brands/concerns by their titles.
export async function POST() {
  const denied = await adminGuard();
  if (denied) return denied;
  const [lib, tax, idx] = await Promise.all([getVideoLibrary(), getTaxonomy(), getIndex()]);
  const brands = Array.from(new Set(idx.all.map((p) => p.brand)));
  let added = 0;
  const errors: string[] = [];
  for (const ch of lib.channels) {
    try {
      const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const xml = await r.text();
      for (const entry of xml.split("<entry>").slice(1)) {
        const vid = entry.match(/<yt:videoId>([^<]+)</)?.[1];
        const title = (entry.match(/<title>([^<]*)</)?.[1] ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        if (!vid) continue;
        const url = `https://www.youtube.com/watch?v=${vid}`;
        if (lib.items.some((i) => i.url === url)) continue;
        const tags = ch.autoTag ? suggestTags(title, tax, brands) : { categories: [], brands: [], concerns: [] };
        const item: VideoItem = { id: newId(), url, title, thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`, ...tags, products: [], enabled: true, source: `youtube:${ch.id}`, addedAt: new Date().toISOString() };
        lib.items.unshift(item);
        added++;
      }
      ch.lastSync = new Date().toISOString();
    } catch (e) {
      errors.push(`${ch.name || ch.id}: ${(e as Error).message}`);
    }
  }
  await saveVideoLibrary(lib);
  return NextResponse.json({ added, errors });
}
