"use client";

import { useState } from "react";
import { slugify } from "@/lib/data/catalog";
import { defaultSettings, type Settings } from "@/lib/site";
import { Area, Card, Header, Num, Text, Toggle, useSaver } from "./fields";

const tabs = ["Store", "Announcement bar", "Delivery", "Payments", "Checkout", "SEO", "Trust badges", "Pages"] as const;

export function SettingsEditor({ initial }: { initial: Settings }) {
  const [s, setS] = useState<Settings>(initial);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Store");
  const saver = useSaver("/api/admin/settings/");
  const up = <K extends keyof Settings>(k: K, v: Partial<Settings[K]>) => {
    saver.touch();
    setS((x) => ({ ...x, [k]: Array.isArray(x[k]) ? v : { ...(x[k] as object), ...v } }));
  };

  return (
    <div>
      <Header title="Settings" sub="Store details, delivery, payments and info pages" saver={saver} onSave={() => saver.save(s)} />
      <div className="mb-5 flex flex-wrap gap-1 text-sm">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 ${tab === t ? "bg-ink text-white" : "bg-white hover:bg-brand-50"}`}>{t}</button>
        ))}
      </div>

      {tab === "Store" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Store details">
            <div className="grid gap-4">
              <Text label="Store name" value={s.store.name} onChange={(name) => up("store", { name })} />
              <Text label="Tagline" hint="Shown in the footer and as the default page description" value={s.store.tagline} onChange={(tagline) => up("store", { tagline })} />
              <Text label="Phone" value={s.store.phone} onChange={(phone) => up("store", { phone })} />
              <Text label="WhatsApp number" hint="Digits only with country code, e.g. 9613123456. Used by the chat button." value={s.store.whatsapp} onChange={(whatsapp) => up("store", { whatsapp: whatsapp.replace(/\D/g, "") })} />
              <Text label="Email" value={s.store.email} onChange={(email) => up("store", { email })} />
              <Text label="Address" value={s.store.address} onChange={(address) => up("store", { address })} />
              <Text label="Opening hours" value={s.store.openingHours} onChange={(openingHours) => up("store", { openingHours })} />
            </div>
          </Card>
          <Card title="Social media" sub="Leave empty to hide. Shown in the header bar and footer.">
            <div className="grid gap-4">
              <Text label="TikTok" placeholder="https://www.tiktok.com/@pharmatipss" value={s.social.tiktok} onChange={(tiktok) => up("social", { tiktok })} />
              <Text label="Instagram" placeholder="https://instagram.com/yourshop" value={s.social.instagram} onChange={(instagram) => up("social", { instagram })} />
              <Text label="Facebook" placeholder="https://facebook.com/yourshop" value={s.social.facebook} onChange={(facebook) => up("social", { facebook })} />
              <Text label="YouTube" placeholder="https://youtube.com/@yourshop" value={s.social.youtube} onChange={(youtube) => up("social", { youtube })} />
            </div>
          </Card>
        </div>
      )}

      {tab === "Announcement bar" && (
        <Card title="Announcement bar" sub="The thin coloured strip above the header">
          <div className="grid gap-4">
            <Toggle label="Show the announcement bar" checked={s.announcement.enabled} onChange={(enabled) => up("announcement", { enabled })} />
            <Text label="Message" value={s.announcement.text} onChange={(text) => up("announcement", { text })} />
            <Text label="Link (optional)" placeholder="/shop/?sort=discount" value={s.announcement.link} onChange={(link) => up("announcement", { link })} />
            <Toggle label="Show phone and social links in the bar" checked={s.announcement.showContacts} onChange={(showContacts) => up("announcement", { showContacts })} />
          </div>
        </Card>
      )}

      {tab === "Delivery" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Delivery fees">
            <div className="grid gap-4">
              <Num label="Standard delivery fee ($)" step={0.5} value={s.delivery.fee} onChange={(fee) => up("delivery", { fee })} />
              <Num label="Free delivery from ($)" hint="0 = never free" step={1} value={s.delivery.freeThreshold} onChange={(freeThreshold) => up("delivery", { freeThreshold })} />
              <Text label="Delivery time message" value={s.delivery.estimate} onChange={(estimate) => up("delivery", { estimate })} />
            </div>
          </Card>
          <Card title="Delivery areas" sub="Customers pick one at checkout. Leave the fee empty to use the standard fee.">
            <ul className="space-y-2">
              {s.delivery.zones.map((z, i) => (
                <li key={i} className="flex gap-2">
                  <input value={z.name} onChange={(e) => up("delivery", { zones: s.delivery.zones.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)) })} className="flex-1 rounded-lg border border-line px-3 py-1.5 text-sm" />
                  <input
                    type="number" min={0} step={0.5} placeholder={`$${s.delivery.fee}`} value={z.fee ?? ""}
                    onChange={(e) => up("delivery", { zones: s.delivery.zones.map((x, n) => (n === i ? { name: x.name, ...(e.target.value === "" ? {} : { fee: Number(e.target.value) }) } : x)) })}
                    className="w-24 rounded-lg border border-line px-3 py-1.5 text-sm"
                  />
                  <button onClick={() => up("delivery", { zones: s.delivery.zones.filter((_, n) => n !== i) })} className="px-2 text-sale">✕</button>
                </li>
              ))}
            </ul>
            <button onClick={() => up("delivery", { zones: [...s.delivery.zones, { name: "New area" }] })} className="mt-3 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-brand-50">+ Add area</button>
          </Card>
        </div>
      )}

      {tab === "Payments" && (
        <div className="grid gap-5 lg:grid-cols-3">
          {(["cod", "card", "whish"] as const).map((m) => (
            <Card key={m} title={{ cod: "Cash on delivery", card: "Card payments", whish: "Whish Money" }[m]} sub={m === "card" ? "Only appears once a card gateway (Tap, Areeba or Stripe) is set up in Vercel environment variables." : undefined}>
              <div className="grid gap-3">
                <Toggle label="Offer at checkout" checked={s.payments[m].enabled} onChange={(enabled) => up("payments", { [m]: { ...s.payments[m], enabled } })} />
                <Text label="Name shown" value={s.payments[m].label} onChange={(label) => up("payments", { [m]: { ...s.payments[m], label } })} />
                <Area label="Description" rows={2} value={s.payments[m].description} onChange={(description) => up("payments", { [m]: { ...s.payments[m], description } })} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "Checkout" && (
        <Card title="Checkout">
          <div className="grid gap-4 md:grid-cols-2">
            <Num label="Minimum order ($)" hint="0 = no minimum" value={s.checkout.minOrder} onChange={(minOrder) => up("checkout", { minOrder })} />
            <Text label="Note shown at checkout" placeholder="e.g. Orders placed after 6pm ship next day" value={s.checkout.note} onChange={(note) => up("checkout", { note })} />
          </div>
        </Card>
      )}

      {tab === "SEO" && (
        <Card title="Search engines & sharing" sub="Leave empty to use “Store name – Tagline”">
          <div className="grid gap-4">
            <Text label="Homepage title" value={s.seo.title} onChange={(title) => up("seo", { title })} />
            <Area label="Meta description" hint={`${s.seo.description.length}/160 characters recommended`} value={s.seo.description} onChange={(description) => up("seo", { description })} />
          </div>
        </Card>
      )}

      {tab === "Trust badges" && (
        <Card title="Trust badges" sub="The four reassurance points above the footer. Leave a title empty to hide it.">
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => {
              const t = s.trust[i] ?? { title: "", text: "" };
              const set = (v: Partial<typeof t>) => { const next = [...s.trust]; while (next.length <= i) next.push({ title: "", text: "" }); next[i] = { ...t, ...v }; saver.touch(); setS({ ...s, trust: next }); };
              return (
                <div key={i} className="grid gap-2 rounded-lg border border-line p-3">
                  <Text label={`Badge ${i + 1} title`} value={t.title} onChange={(title) => set({ title })} />
                  <Text label="Text" value={t.text} onChange={(text) => set({ text })} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tab === "Pages" && <PagesTab s={s} setPages={(pages) => (saver.touch(), setS({ ...s, pages }))} />}
    </div>
  );
}

function PagesTab({ s, setPages }: { s: Settings; setPages: (p: Settings["pages"]) => void }) {
  const [newTitle, setNewTitle] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const entries = Object.entries(s.pages).filter(([slug, p]) => !q || `${slug} ${p.title}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Pages live at /pages/&lt;address&gt;/. Ticked pages are listed in the footer under “Help”. Separate paragraphs with an empty line; lines starting with “• ” become bullet points. The contact page shows your phone, email and address when left empty.</p>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find among ${Object.keys(s.pages).length} pages…`} className="flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
      </div>
      <Card>
        <ul className="divide-y divide-line">
          {entries.slice(0, 400).map(([slug, p]) => (
            <li key={slug}>
              <div className="flex items-center gap-3 py-2 text-sm">
                <input type="checkbox" title="Show in footer" checked={p.footer !== false} onChange={(e) => setPages({ ...s.pages, [slug]: { ...p, footer: e.target.checked } })} />
                <button onClick={() => setOpen(open === slug ? null : slug)} className="min-w-0 flex-1 text-left"><b>{p.title}</b> <span className="font-mono text-xs text-muted">/pages/{slug}/</span></button>
                <a href={`/pages/${slug}/`} target="_blank" className="text-brand-600">View ↗</a>
                {!(slug in defaultSettings.pages) && <button onClick={() => { const n = { ...s.pages }; delete n[slug]; setPages(n); }} className="text-sale">Delete</button>}
              </div>
              {open === slug && (
                <div className="mb-3 grid gap-3 rounded-lg bg-[#fafafa] p-4">
                  <Text label="Title" value={p.title} onChange={(title) => setPages({ ...s.pages, [slug]: { ...p, title } })} />
                  <Area label="Content" rows={10} value={p.body} onChange={(body) => setPages({ ...s.pages, [slug]: { ...p, body } })} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <form onSubmit={(e) => { e.preventDefault(); const slug = slugify(newTitle); if (slug && !s.pages[slug]) { setPages({ ...s.pages, [slug]: { title: newTitle.trim(), body: "", footer: true } }); setNewTitle(""); setOpen(slug); } }} className="flex gap-2">
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New page title, e.g. Terms & conditions" className="flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
        <button className="rounded-lg border border-line bg-white px-4 text-sm hover:bg-brand-50">+ Add page</button>
      </form>
    </div>
  );
}
