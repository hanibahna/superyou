"use client";

import { useState } from "react";
import { finders } from "@/lib/finders";
import { Area, Card, Header, ListInput, MediaField, Num, Select, Text, Toggle, useSaver } from "./fields";

type Section = { enabled: boolean; banner: { title: string; text: string; cta: string; href: string; image: string; bg: string }; tips: string[]; app: { label: string; href: string } };
type Extras = { advisor: { enabled: boolean; name: string; greeting: string; suggestions: string[]; perHour: number }; youtube: { enabled: boolean; key: string; pins: Record<string, string> }; sections: Record<string, Section> };

const apps: [string, string][] = [["", "None"], ["/routine/", "Routine finder"], ["/shade-finder/", "Shade finder"], ["/skin-scan/", "Skin scan"], ...finders.map((f) => [`/finder/${f.id}/`, f.title] as [string, string])];
const blank = (name: string): Section => ({ enabled: true, banner: { title: name, text: "", cta: "Shop now", href: "", image: "", bg: "#fcf1f4" }, tips: [], app: { label: "", href: "" } });

export function SectionsEditor({ initial, categories, aiReady }: { initial: Extras; categories: { slug: string; name: string }[]; aiReady: boolean }) {
  const [e, setE] = useState(initial);
  const saver = useSaver("/api/admin/extras/");
  const [open, setOpen] = useState(categories[0]?.slug ?? "");
  const [pinSlug, setPinSlug] = useState("");
  const [pinId, setPinId] = useState("");
  const up = (x: Partial<Extras>) => (saver.touch(), setE({ ...e, ...x }));
  const upSec = (slug: string, s: Section) => up({ sections: { ...e.sections, [slug]: s } });
  const cur = e.sections[open];

  return (
    <div>
      <Header title="Sections & AI" sub="The AI shopping advisor, YouTube videos on product pages, and the banner, tips and app at the top of every shop section." saver={saver} onSave={() => saver.save(e)} />
      <div className="space-y-5">
        <Card title="AI shopping advisor" sub={aiReady ? "Uses Claude (the same key as the skin scan). It only recommends products in stock and sends medical questions to the pharmacist." : "Needs the ANTHROPIC_API_KEY setting in Vercel to switch on."}>
          <div className="grid gap-3 md:grid-cols-2">
            <Toggle label="Show the advisor on the shop" checked={e.advisor.enabled} onChange={(enabled) => up({ advisor: { ...e.advisor, enabled } })} />
            <Text label="Name" value={e.advisor.name} onChange={(name) => up({ advisor: { ...e.advisor, name } })} />
            <Area label="Greeting" value={e.advisor.greeting} onChange={(greeting) => up({ advisor: { ...e.advisor, greeting } })} className="md:col-span-2" />
            <ListInput label="Suggested questions" hint="One per line, shown as buttons" value={e.advisor.suggestions} onChange={(suggestions) => up({ advisor: { ...e.advisor, suggestions } })} rows={4} />
            <Num label="Questions per visitor per hour" value={e.advisor.perHour} onChange={(perHour) => up({ advisor: { ...e.advisor, perHour } })} min={1} />
          </div>
        </Card>

        <Card title="YouTube videos on product pages" sub="Finds review and how-to videos for each product (strict SafeSearch). Free: create a YouTube Data API v3 key in Google Cloud Console. Results are kept 30 days per product.">
          <div className="grid gap-3 md:grid-cols-2">
            <Toggle label="Show YouTube videos" checked={e.youtube.enabled} onChange={(enabled) => up({ youtube: { ...e.youtube, enabled } })} />
            <Text label="YouTube API key" type="password" hint={<a className="underline" href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">Google Cloud → YouTube Data API v3 → Credentials</a>} value={e.youtube.key} onChange={(key) => up({ youtube: { ...e.youtube, key } })} />
          </div>
          <p className="mt-4 text-sm font-semibold">Pin or hide a video for a product</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Text label="Product slug (from its address)" value={pinSlug} onChange={setPinSlug} placeholder="la-roche-posay-effaclar-duo" />
            <Text label="YouTube video ID or link, or none" value={pinId} onChange={setPinId} placeholder="dQw4w9WgXcQ or none" />
            <button onClick={() => { const id = pinId.trim().toLowerCase() === "none" ? "none" : (pinId.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? pinId.trim()); if (pinSlug.trim() && id) { up({ youtube: { ...e.youtube, pins: { ...e.youtube.pins, [pinSlug.trim()]: id } } }); setPinSlug(""); setPinId(""); } }} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">Add</button>
          </div>
          {Object.keys(e.youtube.pins).length > 0 && (
            <ul className="mt-3 divide-y divide-line text-sm">
              {Object.entries(e.youtube.pins).map(([s, v]) => (
                <li key={s} className="flex items-center justify-between gap-3 py-2"><span><b>{s}</b> → {v === "none" ? "no video" : v}</span><button onClick={() => { const pins = { ...e.youtube.pins }; delete pins[s]; up({ youtube: { ...e.youtube, pins } }); }} className="text-sale">Remove</button></li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Section banners, tips and apps" sub="Shown at the top of each category page: an ad banner, rotating tips, the section's app and the AI advisor.">
          <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1">
            {categories.map((c) => (
              <button key={c.slug} onClick={() => setOpen(c.slug)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${open === c.slug ? "bg-ink text-white" : "border border-line"} ${e.sections[c.slug] ? "" : "opacity-60"}`}>{c.name}</button>
            ))}
          </div>
          {!cur ? (
            <button onClick={() => upSec(open, blank(categories.find((c) => c.slug === open)?.name ?? open))} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">Add a banner for this section</button>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <Toggle label="Show on this section" checked={cur.enabled} onChange={(enabled) => upSec(open, { ...cur, enabled })} />
              <Text label="Banner colour" value={cur.banner.bg} onChange={(bg) => upSec(open, { ...cur, banner: { ...cur.banner, bg } })} placeholder="#ffd6e3" />
              <Text label="Banner title" value={cur.banner.title} onChange={(title) => upSec(open, { ...cur, banner: { ...cur.banner, title } })} />
              <Text label="Banner text" value={cur.banner.text} onChange={(text) => upSec(open, { ...cur, banner: { ...cur.banner, text } })} />
              <Text label="Button" value={cur.banner.cta} onChange={(cta) => upSec(open, { ...cur, banner: { ...cur.banner, cta } })} />
              <Text label="Button link" value={cur.banner.href} onChange={(href) => upSec(open, { ...cur, banner: { ...cur.banner, href } })} placeholder="/shop/?category=…, a brand, an offer…" />
              <MediaField label="Banner picture" value={cur.banner.image} onChange={(image) => upSec(open, { ...cur, banner: { ...cur.banner, image } })} />
              <ListInput label="Tips" hint="One per line; they rotate every 7 seconds" value={cur.tips} onChange={(tips) => upSec(open, { ...cur, tips })} rows={5} />
              <Select label="Section app" value={cur.app.href as string} onChange={(href) => upSec(open, { ...cur, app: { href, label: apps.find(([h]) => h === href)?.[1] ?? "" } })} options={apps} />
              <Text label="App button label" value={cur.app.label} onChange={(label) => upSec(open, { ...cur, app: { ...cur.app, label } })} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
