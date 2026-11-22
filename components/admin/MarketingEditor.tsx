"use client";

import { useState } from "react";
import { blankCampaign, CHANNELS, MASK, PLATFORM_LINKS, slugifyCampaign, trackedLink, type Campaign, type Channel, type Marketing } from "@/lib/marketing";
import { Area, Card, Header, Num, Select, Text, useSaver } from "./fields";

export type CampaignStat = { orders: number; revenue: number };
export type SourceStat = { source: string; orders: number; revenue: number };

const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const STATUS: [Campaign["status"], string][] = [["draft", "Draft"], ["live", "Live"], ["paused", "Paused"], ["ended", "Ended"]];
const OBJECTIVE: [Campaign["objective"], string][] = [["sales", "Sales"], ["traffic", "Traffic"], ["awareness", "Awareness"], ["leads", "Leads / sign-ups"], ["app", "App installs"]];
const statusTone = { draft: "bg-gray-100 text-gray-700", live: "bg-green-100 text-green-800", paused: "bg-amber-100 text-amber-800", ended: "bg-gray-200 text-gray-600" };

type Conn = { key: string; title: string; what: string; fields: { k: keyof Marketing["tracking"]; label: string; ph: string; secret?: boolean }[]; links?: { label: string; href: string }[] };
const CONNECTIONS: Conn[] = [
  { key: "ga4", title: "Google Analytics 4", what: "Visits, traffic sources and sales on the site.", fields: [{ k: "ga4", label: "Measurement ID", ph: "G-XXXXXXXXXX" }], links: [{ label: "Open Analytics", href: "https://analytics.google.com/" }] },
  { key: "gads", title: "Google Ads", what: "Search, Shopping, Performance Max and YouTube ads. Counts each sale as a conversion with its value.", fields: [{ k: "googleAds", label: "Google tag ID", ph: "AW-123456789" }, { k: "googleAdsPurchaseLabel", label: "Purchase conversion label", ph: "AbCdEfGhIj" }], links: [{ label: "Campaigns", href: PLATFORM_LINKS.google!.manager }, { label: "Conversions", href: PLATFORM_LINKS.google!.setup }] },
  { key: "gmc", title: "Google Merchant Center", what: "Shows our products in Google Shopping and powers Performance Max. Add the product feed below as a scheduled fetch.", fields: [{ k: "merchantCenter", label: "Merchant Center ID (for reference)", ph: "123456789" }, { k: "gsc", label: "Google site verification code", ph: "from Search Console" }], links: [{ label: "Open Merchant Center", href: "https://merchants.google.com/" }] },
  { key: "meta", title: "Meta: Instagram & Facebook", what: "Pixel in the browser plus the Conversions API from our server, so sales still count when the browser blocks tracking. Use the product feed for the catalog (Advantage+ shopping, dynamic ads).", fields: [{ k: "metaPixel", label: "Pixel (dataset) ID", ph: "123456789012345" }, { k: "metaToken", label: "Conversions API access token", ph: "paste from Events Manager", secret: true }, { k: "metaTestCode", label: "Test event code (only while testing)", ph: "TEST12345" }, { k: "metaDomain", label: "Domain verification code", ph: "from Business settings" }], links: [{ label: "Ads Manager", href: PLATFORM_LINKS.meta!.manager }, { label: "Events Manager", href: PLATFORM_LINKS.meta!.setup }, { label: "Catalog", href: "https://business.facebook.com/commerce/" }] },
  { key: "tiktok", title: "TikTok", what: "Pixel plus the Events API from our server. Use the product feed for a TikTok catalog (video shopping ads).", fields: [{ k: "tiktokPixel", label: "Pixel ID", ph: "CXXXXXXXXXXXXXXXXXXX" }, { k: "tiktokToken", label: "Events API access token", ph: "paste from Events Manager", secret: true }], links: [{ label: "Ads Manager", href: PLATFORM_LINKS.tiktok!.manager }, { label: "Events Manager", href: PLATFORM_LINKS.tiktok!.setup }] },
  { key: "snap", title: "Snapchat", what: "Snap Pixel for Snapchat ads (popular with 18–30 year olds).", fields: [{ k: "snapPixel", label: "Pixel ID", ph: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }], links: [{ label: "Ads Manager", href: PLATFORM_LINKS.snapchat!.manager }] },
];

export function MarketingEditor({ initial, stats, sources, base }: { initial: Marketing; stats: Record<string, CampaignStat>; sources: SourceStat[]; base: string }) {
  const [m, setM] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"campaigns" | "connections" | "results">("campaigns");
  const [copied, setCopied] = useState("");
  const saver = useSaver("/api/admin/marketing/");
  const setT = (k: keyof Marketing["tracking"], v: string) => (saver.touch(), setM({ ...m, tracking: { ...m.tracking, [k]: v } }));
  const setC = (i: number, patch: Partial<Campaign>) => (saver.touch(), setM({ ...m, campaigns: m.campaigns.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const feed = `${base}/feeds/products.xml`;
  const copy = (s: string) => {
    navigator.clipboard?.writeText(s).catch(() => {});
    setCopied(s);
    setTimeout(() => setCopied(""), 1500);
  };
  const addCampaign = () => {
    const c = { ...blankCampaign(), id: `new-${Date.now().toString(36)}`, name: "New campaign" };
    saver.touch();
    setM({ ...m, campaigns: [c, ...m.campaigns] });
    setOpen(c.id);
    setTab("campaigns");
  };
  const connected = (c: Conn) => c.fields.some((f) => m.tracking[f.k] && !f.k.toLowerCase().includes("test"));
  const live = m.campaigns.filter((c) => c.status === "live");
  const totals = m.campaigns.reduce((t, c) => ({ spend: t.spend + c.spend, revenue: t.revenue + (stats[c.id]?.revenue ?? 0), orders: t.orders + (stats[c.id]?.orders ?? 0) }), { spend: 0, revenue: 0, orders: 0 });

  return (
    <div>
      <Header
        title="Campaigns & ads"
        sub="Plan every campaign here, get the tracked link for each ad, and see the orders and sales it brought. Ads are built and paid for inside each platform: nothing here spends money."
        saver={saver}
        onSave={() => saver.save({ ...m, campaigns: m.campaigns.map((c) => ({ ...c, id: c.id.startsWith("new-") ? "" : c.id, slug: c.slug || slugifyCampaign(c.name) })) })}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Live campaigns", String(live.length)], ["Ad spend", money(totals.spend)], ["Orders from campaigns", String(totals.orders)], ["Return on ad spend", totals.spend ? `${(totals.revenue / totals.spend).toFixed(1)}×` : "–"]].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-line bg-white p-3 md:p-4">
            <p className="text-xs text-muted">{l}</p>
            <p className="mt-1 text-xl font-bold md:text-2xl">{v}</p>
          </div>
        ))}
      </div>

      <div className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
        {([["campaigns", "Campaigns"], ["connections", `Connections (${CONNECTIONS.filter(connected).length}/${CONNECTIONS.length})`], ["results", "Sales by source"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold ${tab === k ? "bg-ink text-white" : "bg-white ring-1 ring-line"}`}>{l}</button>
        ))}
      </div>

      {tab === "campaigns" && (
        <div className="space-y-3">
          <button onClick={addCampaign} className="w-full rounded-xl border-2 border-dashed border-line px-4 py-3.5 text-sm font-semibold hover:border-brand-500 md:w-auto">+ New campaign</button>
          {!m.campaigns.length && <p className="text-sm text-muted">No campaigns yet. Add one for each ad, influencer post, WhatsApp broadcast or QR flyer so you can see what sells.</p>}
          {m.campaigns.map((c, i) => {
            const st = stats[c.id];
            const link = trackedLink(base, { ...c, slug: c.slug || slugifyCampaign(c.name) });
            const roas = c.spend && st ? st.revenue / c.spend : 0;
            const isOpen = open === c.id;
            const pl = PLATFORM_LINKS[c.channel];
            return (
              <div key={c.id} className="overflow-hidden rounded-xl border border-line bg-white">
                <button onClick={() => setOpen(isOpen ? null : c.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-4 text-left">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone[c.status]}`}>{STATUS.find((s) => s[0] === c.status)?.[1]}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{c.name || "Untitled"}</span>
                  <span className="w-full text-xs text-muted md:w-auto">{CHANNELS[c.channel].split(" (")[0]} · {st?.orders ?? 0} orders · {money(st?.revenue ?? 0)}{c.spend ? ` · spent ${money(c.spend)}${roas ? ` · ${roas.toFixed(1)}×` : ""}` : ""}</span>
                </button>
                {isOpen && (
                  <div className="space-y-4 border-t border-line p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Text label="Name" value={c.name} onChange={(v) => setC(i, { name: v })} className="md:col-span-2" />
                      <Select label="Status" value={c.status} onChange={(v) => setC(i, { status: v })} options={STATUS} />
                      <Select label="Channel" value={c.channel} onChange={(v) => setC(i, { channel: v as Channel })} options={Object.entries(CHANNELS) as [Channel, string][]} className="md:col-span-2" />
                      <Select label="Goal" value={c.objective} onChange={(v) => setC(i, { objective: v })} options={OBJECTIVE} />
                      <Text label="Starts" type="date" value={c.start} onChange={(v) => setC(i, { start: v })} />
                      <Text label="Ends" type="date" value={c.end} onChange={(v) => setC(i, { end: v })} />
                      <Num label="Budget ($)" value={c.budget} onChange={(v) => setC(i, { budget: v })} />
                      <Num label="Spent so far ($)" hint="Copy from the platform's report." value={c.spend} onChange={(v) => setC(i, { spend: v })} />
                      <Text label="Landing page" hint="e.g. /collections/make-up/ or /products/…" value={c.landing} onChange={(v) => setC(i, { landing: v.trim() })} className="md:col-span-2" />
                      <Text label="Campaign tag" hint="Leave empty to use the name." value={c.slug} placeholder={slugifyCampaign(c.name)} onChange={(v) => setC(i, { slug: slugifyCampaign(v) })} />
                      <Text label="Ad / creative name" hint="Optional, to compare ads." value={c.content} onChange={(v) => setC(i, { content: v })} />
                      <Text label="Discount code" hint="Orders using it count for this campaign too." value={c.coupon} onChange={(v) => setC(i, { coupon: v.toUpperCase() })} />
                    </div>
                    <div className="rounded-xl bg-[#faf7f8] p-3">
                      <p className="text-xs font-semibold">Link to use in the ad</p>
                      <p className="mt-1 break-all font-mono text-xs">{link}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button onClick={() => copy(link)} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">{copied === link ? "Copied ✓" : "Copy link"}</button>
                        {pl && <a href={pl.manager} target="_blank" rel="noreferrer" className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold">Open {CHANNELS[c.channel].split(" (")[0].split(":")[0]} ↗</a>}
                        <a href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold">QR code ↗</a>
                      </div>
                    </div>
                    <Area label="Notes" value={c.notes} onChange={(v) => setC(i, { notes: v })} rows={2} />
                    <button onClick={() => { if (confirm(`Remove "${c.name}"?`)) { saver.touch(); setM({ ...m, campaigns: m.campaigns.filter((_, j) => j !== i) }); } }} className="text-sm font-semibold text-sale">Remove campaign</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "connections" && (
        <div className="space-y-4">
          <Card title="Product feed" sub="One feed for Google Merchant Center, the Meta catalog and the TikTok catalog. Updated every hour; supplier names and costs are never in it.">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-[#faf7f8] px-3 py-2.5 text-xs">{feed}</code>
              <button onClick={() => copy(feed)} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">{copied === feed ? "Copied ✓" : "Copy feed link"}</button>
            </div>
          </Card>
          {CONNECTIONS.map((c) => (
            <Card key={c.key} title={c.title} sub={c.what} actions={<span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${connected(c) ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{connected(c) ? "Connected" : "Not set up"}</span>}>
              <div className="grid gap-3 md:grid-cols-2">
                {c.fields.map((f) => (
                  <Text key={f.k} label={f.label} placeholder={f.ph} type={f.secret ? "password" : "text"} value={m.tracking[f.k]} hint={f.secret && m.tracking[f.k] === MASK ? "Saved. Type a new one to replace it." : undefined} onChange={(v) => setT(f.k, v.trim())} />
                ))}
              </div>
              {c.links && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.links.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-brand-50">{l.label} ↗</a>)}
                </div>
              )}
            </Card>
          ))}
          <p className="text-xs text-muted">Tracked on the shop: product views, add to bag, checkout started and orders (with value and order number). Customer phone and email are only ever sent hashed.</p>
        </div>
      )}

      {tab === "results" && (
        <Card title="Sales by source, last 90 days" sub="Where each order came from, using the campaign tags in links and the site that sent the visitor.">
          {!sources.length ? <p className="text-sm text-muted">No orders yet.</p> : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="p-2">Source / medium</th><th className="p-2 text-right">Orders</th><th className="p-2 text-right">Sales</th></tr></thead>
                <tbody>{sources.map((s) => <tr key={s.source} className="border-t border-line"><td className="p-2">{s.source}</td><td className="p-2 text-right">{s.orders}</td><td className="p-2 text-right font-semibold">{money(s.revenue)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
