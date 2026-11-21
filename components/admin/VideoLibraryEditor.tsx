"use client";

import { useState } from "react";
import { thumbFor } from "@/components/Video";
import type { Taxonomy } from "@/lib/data/catalog";
import { newId, parseVideo, type VideoItem, type VideoLibrary } from "@/lib/site";
import { suggestTags } from "@/lib/video-tags";
import { Card, Chips, Header, ListInput, MediaField, ProductPicker, Text, Toggle, useSaver } from "./fields";

export function VideoLibraryEditor({ initial, taxonomy, brands, tiktok }: { initial: VideoLibrary; taxonomy: Taxonomy; brands: string[]; tiktok: string }) {
  const [lib, setLib] = useState<VideoLibrary>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [links, setLinks] = useState("");
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("");
  const [upload, setUpload] = useState("");
  const saver = useSaver("/api/admin/videos/");
  const set = (next: VideoLibrary) => (saver.touch(), setLib(next));
  const upV = (id: string, patch: Partial<VideoItem>) => set({ ...lib, items: lib.items.map((v) => (v.id === id ? { ...v, ...patch } : v)) });

  async function addLinks(text: string) {
    const urls = Array.from(new Set(text.split(/\s+/).map((u) => u.trim()).filter((u) => /^https?:\/\//.test(u) && parseVideo(u))));
    const fresh = urls.filter((u) => !lib.items.some((i) => i.url === u));
    if (!fresh.length) return setBusy(urls.length ? "Those videos are already in the library." : "No video links found.");
    const added: VideoItem[] = [];
    for (const [n, url] of fresh.entries()) {
      setBusy(`Reading video ${n + 1} of ${fresh.length}…`);
      const info = await fetch(`/api/admin/videos/info/?url=${encodeURIComponent(url)}`).then((r) => r.json()).catch(() => ({}));
      const title = info.title || "";
      added.push({ id: newId(), url, title, thumbnail: info.thumbnail || thumbFor(url), ...suggestTags(title, taxonomy, brands), products: [], enabled: true, addedAt: new Date().toISOString() });
    }
    set({ ...lib, items: [...added, ...lib.items] });
    setLinks("");
    setBusy(`Added ${added.length} video${added.length === 1 ? "" : "s"} — tags were suggested from the titles; check them, then Save.`);
  }

  async function sync() {
    if (saver.dirty) await saver.save(lib);
    setBusy("Checking YouTube channels…");
    const r = await fetch("/api/admin/videos/sync/", { method: "POST" }).then((x) => x.json()).catch(() => ({ errors: ["Network error"] }));
    setBusy(`${r.added ?? 0} new video(s) added${r.errors?.length ? ` · ${r.errors.join("; ")}` : ""}. Reload to see them.`);
  }

  const shown = lib.items.filter((v) => !filter || `${v.title} ${v.brands.join(" ")} ${v.categories.join(" ")}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <Header title="Video library" sub="TikTok, Instagram, YouTube, Facebook and Vimeo videos — shown on the right category, brand and product pages" saver={saver} onSave={() => saver.save(lib)} />

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Add videos" sub="Paste one or many links (one per line). Title and thumbnail are read automatically for TikTok, YouTube and Vimeo; categories, brands and concerns are suggested from the title.">
          <textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={4} placeholder={"https://www.tiktok.com/@pharmatipss/video/7312345678901234567\nhttps://www.instagram.com/reel/C1abcDEF/\nhttps://youtu.be/abc123"} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button onClick={() => addLinks(links)} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">Add to library</button>
            {busy && <span className="text-sm text-muted">{busy}</span>}
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <MediaField kind="video" label="…or upload a video file" value={upload} onChange={(u) => { setUpload(u); if (u) { addLinks(u); setUpload(""); } }} />
          </div>
        </Card>

        <div className="space-y-5">
          <Card title="Where videos appear">
            <div className="grid gap-3">
              <Toggle label="Category pages" hint="Videos tagged with that category" checked={lib.show.category} onChange={(category) => set({ ...lib, show: { ...lib.show, category } })} />
              <Toggle label="Brand pages" hint="Videos tagged with that brand" checked={lib.show.brand} onChange={(brand) => set({ ...lib, show: { ...lib.show, brand } })} />
              <Toggle label="Product pages" hint="Videos linked to the product, or tagged with its brand and category" checked={lib.show.product} onChange={(product) => set({ ...lib, show: { ...lib.show, product } })} />
              <Toggle label="Search results" hint="Videos whose title matches the search" checked={lib.show.search} onChange={(search) => set({ ...lib, show: { ...lib.show, search } })} />
            </div>
            <p className="mt-3 text-xs text-muted">Also add a “Social videos” section on the Homepage — either from this library or your live TikTok profile feed{tiktok ? ` (${tiktok.replace(/^https?:\/\/(www\.)?/, "")})` : ""}.</p>
          </Card>
          <Card title="YouTube channels (automatic)" sub="New uploads are pulled in and tagged automatically when you press Sync. Find the channel id (starts with UC) on the channel's About page → Share → Copy channel ID.">
            {lib.channels.map((c, i) => (
              <div key={i} className="mb-2 flex items-end gap-2">
                <Text className="flex-1" label="Name" value={c.name} onChange={(name) => set({ ...lib, channels: lib.channels.map((x, n) => (n === i ? { ...x, name } : x)) })} />
                <Text className="flex-1" label="Channel id" value={c.id} onChange={(id) => set({ ...lib, channels: lib.channels.map((x, n) => (n === i ? { ...x, id: id.trim() } : x)) })} />
                <button onClick={() => set({ ...lib, channels: lib.channels.filter((_, n) => n !== i) })} className="pb-2 text-sale">✕</button>
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={() => set({ ...lib, channels: [...lib.channels, { platform: "youtube", id: "", name: "", autoTag: true }] })} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-brand-50">+ Add channel</button>
              {lib.channels.length > 0 && <button onClick={sync} className="rounded-lg bg-ink px-3 py-1.5 text-sm text-white">Sync now</button>}
            </div>
            <p className="mt-3 text-xs text-muted">TikTok and Instagram don't let shops pull a feed without an approved developer app, so paste their video links above (you can paste 20 at once). The homepage “TikTok profile” section shows your latest TikToks live.</p>
          </Card>
        </div>
      </div>

      <div className="mt-5" />
      <Card title={`Library (${lib.items.length})`} actions={<input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" className="w-48 rounded-lg border border-line px-3 py-1.5 text-sm" />}>
        {lib.items.length === 0 && <p className="text-sm text-muted">No videos yet.</p>}
        <ul className="divide-y divide-line">
          {shown.map((v) => {
            const kind = parseVideo(v.url)?.kind ?? "?";
            const t = thumbFor(v.url, v.thumbnail);
            return (
              <li key={v.id} className={v.enabled ? "" : "opacity-50"}>
                <div className="flex items-center gap-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t ? <img src={t} alt="" className="h-14 w-10 rounded object-cover" /> : <span className="grid h-14 w-10 place-items-center rounded bg-ink text-xs text-white">▶</span>}
                  <button onClick={() => setOpen(open === v.id ? null : v.id)} className="min-w-0 flex-1 text-left text-sm">
                    <span className="block truncate font-semibold">{v.title || "(no title)"}</span>
                    <span className="text-xs text-muted">
                      {kind} · {[...v.categories.map((c) => taxonomy.categories.find((x) => x.slug === c)?.name ?? c), ...v.brands, ...v.concerns.map((c) => taxonomy.concerns.find((x) => x.slug === c)?.name ?? c)].join(", ") || <span className="text-sale">not tagged — won't show on category pages</span>}
                      {v.products.length > 0 && ` · ${v.products.length} product(s)`}
                    </span>
                  </button>
                  <Toggle label="" checked={v.enabled} onChange={(enabled) => upV(v.id, { enabled })} />
                  <a href={v.url} target="_blank" className="text-sm text-brand-600">Open ↗</a>
                  <button onClick={() => set({ ...lib, items: lib.items.filter((x) => x.id !== v.id) })} className="text-sm text-sale">Delete</button>
                </div>
                {open === v.id && (
                  <div className="mb-3 grid gap-4 rounded-lg bg-[#fafafa] p-4">
                    <Text label="Title" value={v.title} onChange={(title) => upV(v.id, { title })} />
                    <Chips label="Categories" options={taxonomy.categories.map((c) => ({ value: c.slug, label: c.name }))} value={v.categories} onChange={(categories) => upV(v.id, { categories })} />
                    <Chips label="Concerns" options={taxonomy.concerns.map((c) => ({ value: c.slug, label: c.name }))} value={v.concerns} onChange={(concerns) => upV(v.id, { concerns })} />
                    <ListInput label="Brands (comma separated, as spelled in the catalog)" value={v.brands} onChange={(b) => upV(v.id, { brands: b })} />
                    <ProductPicker label="Products featured in this video (shows on their pages)" by="slug" max={20} value={v.products} onChange={(products) => upV(v.id, { products })} />
                    <button onClick={() => upV(v.id, suggestTags(v.title, taxonomy, brands))} className="w-fit rounded-lg border border-line bg-white px-3 py-1.5 text-sm">Re-suggest tags from title</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
