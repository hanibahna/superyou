"use client";

import { useState } from "react";
import { TAGS, tagLabels, type Taxonomy } from "@/lib/data/catalog";
import { emptySlide, emptyTile, newId, newSection, sectionLabels, type Landing, type Section, type SectionType, type Tile } from "@/lib/site";
import { Area, CatalogPick, Chips, Header, ListInput, MediaField, Num, ProductPicker, Select, Text, Toggle, move, useSaver } from "./fields";

export function HomepageEditor({ initial, taxonomy, brands }: { initial: Landing; taxonomy: Taxonomy; brands: string[] }) {
  const [l, setL] = useState<Landing>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const saver = useSaver("/api/admin/landing/");
  const setSections = (sections: Section[]) => (saver.touch(), setL({ sections }));
  const update = (id: string, patch: Partial<Section>) => setSections(l.sections.map((s) => (s.id === id ? ({ ...s, ...patch } as Section) : s)));

  return (
    <div>
      <Header
        title="Homepage"
        sub="Add, reorder, hide and edit the sections of your homepage"
        saver={saver}
        onSave={() => saver.save(l)}
        extra={<a href="/" target="_blank" className="text-sm text-brand-600 hover:underline">Preview ↗</a>}
      />
      <ol className="space-y-2">
        {l.sections.map((s, i) => (
          <li key={s.id} className={`rounded-xl bg-white shadow-sm ${s.enabled ? "" : "opacity-60"}`}>
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="w-6 text-xs text-muted">{i + 1}</span>
              <button onClick={() => setOpen(open === s.id ? null : s.id)} className="flex-1 text-left">
                <span className="font-semibold">{sectionLabels[s.type].label}</span>
                <span className="ml-2 text-sm text-muted">{summary(s)}</span>
              </button>
              <Toggle label="" checked={s.enabled} onChange={(enabled) => update(s.id, { enabled })} />
              <button title="Move up" disabled={i === 0} onClick={() => setSections(move(l.sections, i, -1))} className="rounded px-2 py-1 text-muted hover:bg-line disabled:opacity-30">↑</button>
              <button title="Move down" disabled={i === l.sections.length - 1} onClick={() => setSections(move(l.sections, i, 1))} className="rounded px-2 py-1 text-muted hover:bg-line disabled:opacity-30">↓</button>
              <button title="Duplicate" onClick={() => setSections([...l.sections.slice(0, i + 1), { ...structuredClone(s), id: newId() }, ...l.sections.slice(i + 1)])} className="rounded px-2 py-1 text-muted hover:bg-line">⧉</button>
              <button title="Delete" onClick={() => window.confirm("Remove this section?") && setSections(l.sections.filter((x) => x.id !== s.id))} className="rounded px-2 py-1 text-sale hover:bg-red-50">✕</button>
              <button onClick={() => setOpen(open === s.id ? null : s.id)} className="rounded-lg border border-line px-3 py-1 text-sm">{open === s.id ? "Close" : "Edit"}</button>
            </div>
            {open === s.id && (
              <div className="space-y-4 border-t border-line p-4">
                <SectionForm s={s} set={(p) => update(s.id, p)} taxonomy={taxonomy} brands={brands} />
                <Toggle label="Hide on phones" hint="Keeps the phone page short: the section still shows on computers and tablets." checked={!!s.hideOnMobile} onChange={(hideOnMobile) => update(s.id, { hideOnMobile })} />
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-4">
        {adding ? (
          <div className="grid gap-2 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(sectionLabels) as SectionType[]).map((t) => (
              <button key={t} onClick={() => { const s = newSection(t); setSections([...l.sections, s]); setOpen(s.id); setAdding(false); }} className="rounded-lg border border-line p-3 text-left hover:border-brand-500 hover:bg-brand-50">
                <span className="block font-semibold">{sectionLabels[t].label}</span>
                <span className="text-xs text-muted">{sectionLabels[t].hint}</span>
              </button>
            ))}
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full rounded-xl border-2 border-dashed border-line py-4 font-semibold text-muted hover:border-brand-500 hover:text-brand-600">+ Add section</button>
        )}
      </div>
    </div>
  );
}

function summary(s: Section): string {
  switch (s.type) {
    case "bfhero": return `${s.title} · ${s.images.filter((t) => t.image).length} pictures`;
    case "tiles": case "offers": return `${s.title ? s.title + " · " : ""}${s.items.length} cards`;
    case "circles": return `${s.items.length} circles`;
    case "hero": return `${s.slides.length} slide${s.slides.length === 1 ? "" : "s"}`;
    case "products": return `${s.title} · ${s.source.kind}${s.source.value ? `: ${s.source.value.slice(0, 40)}` : ""}`;
    case "banners": return `${s.items.length} banner${s.items.length === 1 ? "" : "s"}`;
    case "social": return s.source === "tiktok-profile" ? `TikTok @${s.handle.replace(/^@/, "")}` : s.title;
    case "reviews": return `${s.title} · ${s.minRating}+ stars`;
    case "brands": return s.brands.length ? `${s.brands.length} chosen brands` : "Top brands automatically";
    default: return "title" in s ? s.title : "";
  }
}

const grid = "grid gap-4 md:grid-cols-2";

function SectionForm({ s, set, taxonomy, brands }: { s: Section; set: (p: Partial<Section>) => void; taxonomy: Taxonomy; brands: string[] }) {
  const catOpts = taxonomy.categories.map((c) => ({ value: c.slug, label: c.name }));
  switch (s.type) {
    case "bfhero":
      return (
        <div className="space-y-4">
          <div className={grid}>
            <Text label="Small label" value={s.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
            <Text label="Headline" hint="Put *stars* around a word to show it in your rose colour, e.g. Up to *70%* off" value={s.title} onChange={(title) => set({ title })} />
            <Area label="Text" value={s.text} onChange={(text) => set({ text })} />
            <Text label="Scrolling ticker text (optional)" value={s.badge} onChange={(badge) => set({ badge })} placeholder="Black Friday · up to 50% off" />
            <div className="grid grid-cols-2 gap-2"><Text label="Button" value={s.cta} onChange={(cta) => set({ cta })} /><Text label="Link" value={s.href} onChange={(href) => set({ href })} /></div>
            <div className="grid grid-cols-2 gap-2"><Text label="Second button" value={s.cta2} onChange={(cta2) => set({ cta2 })} /><Text label="Link" value={s.href2} onChange={(href2) => set({ href2 })} /></div>
            <Text type="datetime-local" label="Countdown ends (optional)" value={s.endsAt ? s.endsAt.slice(0, 16) : ""} onChange={(v) => set({ endsAt: v ? new Date(v).toISOString() : "" })} />
          </div>
          <div className="rounded-lg border border-line p-3">
            <p className="mb-2 text-sm font-semibold">Background video (optional)</p>
            <div className={grid}>
              <MediaField kind="video" label="Video (MP4, 6–15 s, under 5 MB, no sound needed)" hint="Plays muted and looped behind the headline. Phones on data saver and visitors who reduce motion see the picture instead." value={s.video ?? ""} onChange={(video) => set({ video })} />
              <MediaField label="Still picture (shown while loading)" hint="1920×1080, same first frame as the video" value={s.poster ?? ""} onChange={(poster) => set({ poster })} />
              <Num label="Darken the video (%)" hint="Keeps the headline readable. 40–60 works well." value={s.overlay ?? 50} onChange={(overlay) => set({ overlay })} />
            </div>
          </div>
          <div className="rounded-lg border border-line p-3">
            <Toggle label="Auto-scrolling product slider" hint="Replaces the picture collage with real products that slide by on their own, each with price and Add to bag." checked={!!s.slider?.enabled} onChange={(enabled) => set({ slider: { source: { kind: "sale", value: "" }, limit: 12, interval: 3.5, ...s.slider, enabled } })} />
            {s.slider?.enabled && (
              <div className={`${grid} mt-3`}>
                <Select label="Products" value={s.slider.source.kind} onChange={(kind) => set({ slider: { ...s.slider!, source: { kind, value: kind === "tag" ? "favorite" : "" } } })} options={[["sale", "Biggest deals on sale"], ["tag", "By badge (best sellers, new…)"], ["collection", "From a collection"], ["brand", "From brands (comma separated)"], ["category", "From a category"], ["skus", "Hand-picked products"], ["newest", "Newest added"]]} />
                {s.slider.source.kind === "tag" && <Select label="Badge" value={s.slider.source.value} onChange={(value) => set({ slider: { ...s.slider!, source: { ...s.slider!.source, value } } })} options={TAGS.map((t) => [t, tagLabels[t]])} />}
                {["collection", "brand", "category"].includes(s.slider.source.kind) && <Text label={s.slider.source.kind === "collection" ? "Collection address" : s.slider.source.kind === "brand" ? "Brands" : "Category slug"} value={s.slider.source.value} onChange={(value) => set({ slider: { ...s.slider!, source: { ...s.slider!.source, value } } })} />}
                {s.slider.source.kind === "skus" && <ProductPicker label="Products (in this order)" by="slug" value={s.slider.source.value.split(",").filter(Boolean)} onChange={(v) => set({ slider: { ...s.slider!, source: { ...s.slider!.source, value: v.join(",") } } })} />}
                <Num label="How many products" value={s.slider.limit} onChange={(limit) => set({ slider: { ...s.slider!, limit } })} />
                <Num label="Seconds per slide" value={s.slider.interval} step={0.5} onChange={(interval) => set({ slider: { ...s.slider!, interval } })} />
              </div>
            )}
          </div>
          {!s.slider?.enabled && <TileList items={s.images} onChange={(images) => set({ images })} max={6} fields={["badge", "title"]} label="Collage pictures (4 or 6)" />}
        </div>
      );
    case "tiles":
    case "offers":
      return (
        <div className="space-y-4">
          <div className={grid}>
            <Text label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
            <Text label="Title" value={s.title} onChange={(title) => set({ title })} />
          </div>
          <TileList items={s.items} onChange={(items) => set({ items })} max={s.type === "tiles" ? 16 : 12} fields={["title", "text", "cta", "badge", "bg"]} label="Cards" />
        </div>
      );
    case "circles":
      return (
        <div className="space-y-4">
          <Text label="Title" value={s.title} onChange={(title) => set({ title })} />
          <TileList items={s.items} onChange={(items) => set({ items })} max={16} fields={["title", "bg"]} label="Circles" />
        </div>
      );
    case "hero":
      return (
        <div className="space-y-4">
          <div className={grid}>
            <Num label="Seconds per slide" min={2} value={s.interval} onChange={(interval) => set({ interval })} />
            <Select label="Height" value={s.height} onChange={(height) => set({ height })} options={[["small", "Small"], ["medium", "Medium"], ["large", "Large"]]} />
          </div>
          {s.slides.map((sl, i) => {
            const up = (p: Partial<typeof sl>) => set({ slides: s.slides.map((x, n) => (n === i ? { ...x, ...p } : x)) });
            return (
              <div key={i} className="rounded-lg border border-line p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-semibold">Slide {i + 1}</p>
                  <div className="flex gap-1 text-sm">
                    <button disabled={i === 0} onClick={() => set({ slides: move(s.slides, i, -1) })} className="rounded px-2 hover:bg-line disabled:opacity-30">↑</button>
                    <button disabled={i === s.slides.length - 1} onClick={() => set({ slides: move(s.slides, i, 1) })} className="rounded px-2 hover:bg-line disabled:opacity-30">↓</button>
                    <button disabled={s.slides.length === 1} onClick={() => set({ slides: s.slides.filter((_, n) => n !== i) })} className="rounded px-2 text-sale hover:bg-red-50 disabled:opacity-30">Remove</button>
                  </div>
                </div>
                <div className={grid}>
                  <Text label="Small heading" value={sl.eyebrow} onChange={(eyebrow) => up({ eyebrow })} />
                  <Text label="Title" value={sl.title} onChange={(title) => up({ title })} />
                  <Text label="Text" value={sl.text} onChange={(text) => up({ text })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Text label="Button text" value={sl.cta} onChange={(cta) => up({ cta })} />
                    <Text label="Button link" value={sl.href} onChange={(href) => up({ href })} />
                  </div>
                  <MediaField label="Photo" hint="Optional. Wide photos work best for “Full background”." value={sl.image} onChange={(image) => up({ image })} />
                  <MediaField kind="video" label="Video (plays muted, on loop)" hint="Optional. MP4 upload, YouTube or Vimeo. Shown instead of the photo." value={sl.video} onChange={(video) => up({ video })} />
                  <Select label="Layout" value={sl.layout} onChange={(layout) => up({ layout })} options={[["split", "Text left, photo/video right"], ["cover", "Photo/video as full background"]]} />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-sm"><span className="mb-1 block font-medium">Colour from</span><input type="color" value={sl.from} onChange={(e) => up({ from: e.target.value })} className="h-9 w-full rounded border border-line" /></label>
                    <label className="text-sm"><span className="mb-1 block font-medium">Colour to</span><input type="color" value={sl.to} onChange={(e) => up({ to: e.target.value })} className="h-9 w-full rounded border border-line" /></label>
                  </div>
                </div>
              </div>
            );
          })}
          <button onClick={() => set({ slides: [...s.slides, emptySlide()] })} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-brand-50">+ Add slide</button>
        </div>
      );
    case "countdown":
      return (
        <div className={grid}>
          <Text label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
          <Text label="Title" value={s.title} onChange={(title) => set({ title })} />
          <Text type="datetime-local" label="Ends at" hint="Empty = counts down to midnight every day. The section hides itself when time is up." value={s.endsAt ? s.endsAt.slice(0, 16) : ""} onChange={(v) => set({ endsAt: v ? new Date(v).toISOString() : "" })} />
          <Text label="Link when clicked" value={s.href} onChange={(href) => set({ href })} />
        </div>
      );
    case "products": {
      const k = s.source.kind;
      const src = (p: Partial<typeof s.source>) => set({ source: { ...s.source, ...p } });
      return (
        <div className="space-y-4">
          <div className={grid}>
            <Text label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
            <Text label="Title" value={s.title} onChange={(title) => set({ title })} />
            <Select label="Products to show" value={k} onChange={(kind) => src({ kind, value: kind === "tag" ? "favorite" : "" })} options={[["tag", "By badge (deals, new, best sellers…)"], ["category", "From categories"], ["brand", "From brands"], ["concern", "By concern"], ["search", "Search results for a word"], ["skus", "Hand-picked products"], ["collection", "From a collection"], ["sale", "Everything on sale"], ["newest", "Newest added"]]} />
            {k === "tag" && <Select label="Badge" value={s.source.value} onChange={(value) => src({ value })} options={TAGS.map((t) => [t, tagLabels[t]])} />}
            {k === "collection" && <Text label="Collection address" hint="As in /collections/<address>/ — see Catalog → Collections" value={s.source.value} onChange={(value) => src({ value: value.replace(/^\/?collections\//, "").replace(/\/$/, "") })} placeholder="value-deals" />}
            {k === "search" && <Text label="Search words" value={s.source.value} onChange={(value) => src({ value })} placeholder="e.g. vitamin c serum" />}
          </div>
          {k === "category" && <Chips label="Categories" options={catOpts} value={s.source.value.split(",").filter(Boolean)} onChange={(v) => src({ value: v.join(",") })} />}
          {k === "concern" && <Chips label="Concerns" options={taxonomy.concerns.map((c) => ({ value: c.slug, label: c.name }))} value={s.source.value.split(",").filter(Boolean)} onChange={(v) => src({ value: v.join(",") })} />}
          {k === "brand" && <BrandPick brands={brands} value={s.source.value.split(",").filter(Boolean)} onChange={(v) => src({ value: v.join(",") })} />}
          {k === "skus" && <ProductPicker label="Products (in this order)" by="slug" value={s.source.value.split(",").filter(Boolean)} onChange={(v) => src({ value: v.join(",") })} />}
          <div className="grid gap-4 md:grid-cols-3">
            <Num label="How many" min={1} value={s.limit} onChange={(limit) => set({ limit: Math.min(48, Math.max(1, limit)) })} />
            <Select label="Order" value={s.sort} onChange={(sort) => set({ sort })} options={[["featured", "Best sellers first"], ["discount", "Biggest discount"], ["price-asc", "Lowest price"], ["new", "Newest"]]} />
            <Select label="Layout" value={s.layout} onChange={(layout) => set({ layout })} options={[["carousel", "Scrolling row"], ["grid", "Grid"]]} />
          </div>
        </div>
      );
    }
    case "categories":
      return (
        <div className="space-y-4">
          <div className={grid}>
            <Text label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
            <Text label="Title" value={s.title} onChange={(title) => set({ title })} />
          </div>
          <Chips label="Categories to show (none selected = all menu categories)" hint="Tile pictures are set in Categories & concerns; otherwise a product photo is used." options={catOpts} value={s.slugs} onChange={(slugs) => set({ slugs })} />
        </div>
      );
    case "concerns":
      return (
        <div className={grid}>
          <Text label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
          <Text label="Title" value={s.title} onChange={(title) => set({ title })} />
        </div>
      );
    case "brands":
      return (
        <div className="space-y-4">
          <div className={grid}>
            <Text label="Title" value={s.title} onChange={(title) => set({ title })} />
            <Num label="How many" value={s.limit} onChange={(limit) => set({ limit })} />
          </div>
          <BrandPick brands={brands} value={s.brands} onChange={(b) => set({ brands: b })} hint="None selected = brands with the most products" />
          <div>
            <p className="mb-2 text-sm font-medium">Brand logos <span className="font-normal text-muted">— transparent PNG or SVG, about 400×160. Brands without a logo show their name.</span></p>
            <div className="grid gap-3 md:grid-cols-2">
              {(s.brands.length ? s.brands : brands.slice(0, s.limit)).map((b) => {
                const cur = s.logos?.find((l) => l.brand.toLowerCase() === b.toLowerCase())?.image ?? "";
                return <MediaField key={b} label={b} value={cur} onChange={(image) => set({ logos: [...(s.logos ?? []).filter((l) => l.brand.toLowerCase() !== b.toLowerCase()), ...(image ? [{ brand: b, image }] : [])] })} />;
              })}
            </div>
          </div>
        </div>
      );
    case "reviews":
      return (
        <div className={grid}>
          <Text label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
          <Text label="Title" value={s.title} onChange={(title) => set({ title })} />
          <Num label="Minimum stars" value={s.minRating} onChange={(minRating) => set({ minRating })} />
          <Num label="How many reviews" value={s.limit} onChange={(limit) => set({ limit })} />
          <p className="text-xs text-muted md:col-span-2">Shows the latest approved reviews (Marketing → Reviews). Stays hidden until at least 3 qualify.</p>
        </div>
      );
    case "banners":
      return (
        <div className="space-y-4">
          <div className={grid}>
            <Text label="Title (optional)" value={s.title} onChange={(title) => set({ title })} />
            <Select label="Banners per row" value={String(s.columns) as "1" | "2" | "3"} onChange={(c) => set({ columns: Number(c) as 1 | 2 | 3 })} options={[["1", "1 (full width)"], ["2", "2"], ["3", "3"]]} />
          </div>
          {s.items.map((b, i) => {
            const up = (p: Partial<typeof b>) => set({ items: s.items.map((x, n) => (n === i ? { ...x, ...p } : x)) });
            return (
              <div key={i} className="rounded-lg border border-line p-4">
                <div className="mb-3 flex justify-between"><p className="font-semibold">Banner {i + 1}</p><button disabled={s.items.length === 1} onClick={() => set({ items: s.items.filter((_, n) => n !== i) })} className="text-sm text-sale disabled:opacity-30">Remove</button></div>
                <div className={grid}>
                  <MediaField label="Picture" value={b.image} onChange={(image) => up({ image })} />
                  <MediaField kind="video" label="Video (optional, plays muted)" value={b.video} onChange={(video) => up({ video })} />
                  <Text label="Title" value={b.title} onChange={(title) => up({ title })} />
                  <Text label="Text" value={b.text} onChange={(text) => up({ text })} />
                  <Text label="Link" value={b.href} onChange={(href) => up({ href })} placeholder="/shop/?brand=CeraVe" />
                </div>
              </div>
            );
          })}
          {s.items.length < 6 && <button onClick={() => set({ items: [...s.items, { image: "", video: "", title: "", text: "", href: "/shop/" }] })} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-brand-50">+ Add banner</button>}
        </div>
      );
    case "video":
      return (
        <div className={grid}>
          <MediaField kind="video" label="Video" hint="Upload an MP4, or paste a YouTube, Vimeo, TikTok or Instagram link" value={s.url} onChange={(url) => set({ url })} />
          <MediaField label="Cover picture (uploaded videos only)" value={s.poster} onChange={(poster) => set({ poster })} />
          <Text label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
          <Text label="Title" value={s.title} onChange={(title) => set({ title })} />
          <Area label="Text" value={s.text} onChange={(text) => set({ text })} />
          <div className="grid grid-cols-2 gap-2">
            <Text label="Button text" value={s.cta} onChange={(cta) => set({ cta })} />
            <Text label="Button link" value={s.href} onChange={(href) => set({ href })} />
          </div>
          <Toggle label="Autoplay (muted)" checked={s.autoplay} onChange={(autoplay) => set({ autoplay })} />
        </div>
      );
    case "text":
      return (
        <div className={grid}>
          <Text label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
          <Text label="Title" value={s.title} onChange={(title) => set({ title })} />
          <Area label="Text" rows={4} value={s.body} onChange={(body) => set({ body })} className="md:col-span-2" />
          <Text label="Button text" value={s.cta} onChange={(cta) => set({ cta })} />
          <Text label="Button link" value={s.href} onChange={(href) => set({ href })} />
          <Select label="Alignment" value={s.align} onChange={(align) => set({ align })} options={[["center", "Centered"], ["left", "Left"]]} />
          <Select label="Background" value={s.background} onChange={(background) => set({ background })} options={[["soft", "Soft brand colour"], ["dark", "Dark"], ["none", "None"]]} />
        </div>
      );
    case "newsletter":
      return (
        <div className={grid}>
          <Text label="Title" value={s.title} onChange={(title) => set({ title })} />
          <Text label="Text" value={s.text} onChange={(text) => set({ text })} />
        </div>
      );
    case "social":
      return (
        <div className="space-y-4">
          <div className={grid}>
            <Text label="Small heading" value={s.eyebrow} onChange={(eyebrow) => set({ eyebrow })} />
            <Text label="Title" value={s.title} onChange={(title) => set({ title })} />
            <Select label="Show" value={s.source} onChange={(source) => set({ source })} options={[["library", "Videos from my video library (recommended)"], ["tiktok-profile", "TikTok profile widget (public accounts only)"]]} />
            {s.source === "library" && <Select label="Show as" value={s.display ?? "players"} onChange={(display) => set({ display })} options={[["players", "Players on the page (videos play in place)"], ["cards", "Thumbnails that open a player"], ["shoppable", "Shoppable: players with the products in each video and an Add to bag button"]]} />}
            {s.source === "tiktok-profile" ? (
              <Text label="TikTok username" hint="TikTok shows the feed only for public accounts." value={s.handle} onChange={(handle) => set({ handle: handle.replace(/^@/, "") })} placeholder="pharmatipss" />
            ) : (
              <Num label="How many videos" value={s.limit} onChange={(limit) => set({ limit })} />
            )}
          </div>
          {s.source === "library" && (
            <>
              <Chips label="Only videos tagged with these categories (optional)" options={catOpts} value={s.filter.categories} onChange={(categories) => set({ filter: { ...s.filter, categories } })} />
              <ListInput label="…or these brands (optional, comma separated)" value={s.filter.brands} onChange={(b) => set({ filter: { ...s.filter, brands: b } })} />
            </>
          )}
        </div>
      );
  }
}

function BrandPick({ brands, value, onChange, hint }: { brands: string[]; value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  const [q, setQ] = useState("");
  const list = q ? brands.filter((b) => b.toLowerCase().includes(q.toLowerCase())).slice(0, 30) : [];
  return (
    <div className="text-sm">
      <p className="mb-1 font-medium">Brands</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {value.map((b) => <button key={b} onClick={() => onChange(value.filter((x) => x !== b))} className="rounded-full bg-brand-500 px-2.5 py-1 text-xs text-white">{b} ✕</button>)}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to find a brand…" className="w-full rounded-lg border border-line px-3 py-2" />
      {list.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {list.map((b) => <button key={b} onClick={() => { if (!value.includes(b)) onChange([...value, b]); setQ(""); }} className="rounded-full border border-line px-2.5 py-1 text-xs hover:border-brand-500">{b}</button>)}
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const tileLabels: Record<string, string> = { title: "Title", text: "Text", cta: "Link text", badge: "Badge (e.g. -30%)", bg: "Background colour" };

function TileList({ items, onChange, max, fields, label }: { items: Tile[]; onChange: (v: Tile[]) => void; max: number; fields: (keyof Tile)[]; label: string }) {
  const up = (i: number, p: Partial<Tile>) => onChange(items.map((t, n) => (n === i ? { ...t, ...p } : t)));
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((t, i) => (
          <div key={i} className="rounded-lg border border-line p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <b>#{i + 1}</b>
              <span className="flex gap-1">
                <button disabled={i === 0} onClick={() => onChange(move(items, i, -1))} className="px-1.5 disabled:opacity-30">↑</button>
                <button disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))} className="px-1.5 disabled:opacity-30">↓</button>
                <button disabled={items.length <= 1} onClick={() => onChange(items.filter((_, n) => n !== i))} className="px-1.5 text-sale disabled:opacity-30">✕</button>
              </span>
            </div>
            <div className="grid gap-2">
              <CatalogPick onPick={(image, href, name) => up(i, { image, href, ...(t.title === "Title" || !t.title ? { title: name.slice(0, 60) } : {}) })} />
              <MediaField label="Picture" value={t.image} onChange={(image) => up(i, { image })} />
              <Text label="Link" value={t.href} onChange={(href) => up(i, { href })} />
              {fields.map((f) =>
                f === "bg" ? (
                  <label key={f} className="flex items-center gap-2 text-sm"><input type="color" value={t.bg || "#f5f0eb"} onChange={(e) => up(i, { bg: e.target.value })} className="h-8 w-12 rounded border border-line" /> {tileLabels[f]}</label>
                ) : (
                  <Text key={f} label={tileLabels[f]} value={String(t[f] ?? "")} onChange={(v) => up(i, { [f]: v })} />
                ),
              )}
            </div>
          </div>
        ))}
      </div>
      {items.length < max && <button onClick={() => onChange([...items, emptyTile()])} className="mt-2 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-brand-50">+ Add</button>}
    </div>
  );
}
