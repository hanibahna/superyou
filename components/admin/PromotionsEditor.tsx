"use client";

import { useState } from "react";
import { TAGS, tagLabels, type Taxonomy } from "@/lib/data/catalog";
import { isLive, newId, type Discount, type GiftTier, type Promotions, type Scope } from "@/lib/site";
import { Card, Chips, Header, Num, ProductPicker, Select, Text, Toggle, useSaver } from "./fields";

const newDiscount = (): Discount => ({
  id: newId(), name: "New discount", enabled: false, type: "percent", value: 10, scope: { kind: "all", values: [] }, exclude: { kind: "brand", values: [] },
  code: "", minSubtotal: 0, startsAt: "", endsAt: "", stack: false, usageLimit: 0, used: 0,
});
const newGift = (): GiftTier => ({
  id: newId(), name: "Free gift", enabled: false, minSubtotal: 50, scope: { kind: "all", values: [] }, choices: [], pick: 1, startsAt: "", endsAt: "", showProgress: true,
});

const status = (r: { enabled: boolean; startsAt: string; endsAt: string }) =>
  !r.enabled ? ["Off", "bg-line text-muted"] : isLive(r) ? ["Live", "bg-green-100 text-green-800"] : r.endsAt && Date.parse(r.endsAt) < Date.now() ? ["Ended", "bg-line text-muted"] : ["Scheduled", "bg-amber-100 text-amber-800"];

export function PromotionsEditor({ initial, taxonomy, brands, room = {} }: { initial: Promotions; taxonomy: Taxonomy; brands: string[]; room?: Record<string, number | null> }) {
  const [p, setP] = useState<Promotions>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const saver = useSaver("/api/admin/promotions/");
  const set = (next: Promotions) => (saver.touch(), setP(next));
  const upD = (id: string, patch: Partial<Discount>) => set({ ...p, discounts: p.discounts.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const upG = (id: string, patch: Partial<GiftTier>) => set({ ...p, gifts: p.gifts.map((g) => (g.id === id ? { ...g, ...patch } : g)) });

  return (
    <div>
      <Header title="Discounts & free gifts" sub="Sales by brand, category, concern or product · coupon codes · free gifts by spend" saver={saver} onSave={() => saver.save(p)} />

      <div className="space-y-6">
        <Card
          title="Discounts"
          sub={<>No code = <b>automatic</b>: the sale price shows everywhere (cards, product pages, cart). With a code = <b>coupon</b> the customer types at checkout. A minimum spend makes it a cart discount.</>}
          actions={<button onClick={() => { const d = newDiscount(); set({ ...p, discounts: [d, ...p.discounts] }); setOpen(d.id); }} className="rounded-lg bg-ink px-3 py-1.5 text-sm text-white">+ New discount</button>}
        >
          {p.discounts.length === 0 && <p className="text-sm text-muted">No discounts yet. Example: “20% off all La Roche-Posay this weekend”, or code WELCOME10 for 10% off a first order.</p>}
          <ul className="space-y-2">
            {p.discounts.map((d) => {
              const [st, cls] = status(d);
              return (
                <li key={d.id} className="rounded-lg border border-line">
                  <div className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{st}</span>
                    <button onClick={() => setOpen(open === d.id ? null : d.id)} className="flex-1 text-left text-sm">
                      <b>{d.name}</b>
                      <span className="ml-2 text-muted">{d.type === "percent" ? `${d.value}% off` : `$${d.value} off each`} · {scopeText(d.scope, taxonomy)}{d.code ? ` · code ${d.code}` : " · automatic"}{d.minSubtotal ? ` · min $${d.minSubtotal}` : ""}{d.code && d.usageLimit ? ` · used ${d.used}/${d.usageLimit}` : d.code ? ` · used ${d.used}×` : ""}</span>
                    </button>
                    <Toggle label="" checked={d.enabled} onChange={(enabled) => upD(d.id, { enabled })} />
                    {d.type === "percent" && <RoomHint d={d} room={room} />}
                    <button onClick={() => window.confirm("Delete this discount?") && set({ ...p, discounts: p.discounts.filter((x) => x.id !== d.id) })} className="text-sm text-sale">Delete</button>
                  </div>
                  {open === d.id && (
                    <div className="space-y-4 border-t border-line p-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <Text label="Name (shown to customers)" value={d.name} onChange={(name) => upD(d.id, { name })} />
                        <Select label="Type" value={d.type} onChange={(type) => upD(d.id, { type })} options={[["percent", "Percentage off"], ["fixed", "Amount off each item ($)"]]} />
                        <Num label={d.type === "percent" ? "Percent" : "Amount ($)"} step={d.type === "percent" ? 1 : 0.5} value={d.value} onChange={(value) => upD(d.id, { value })} />
                      </div>
                      <ScopeEditor label="Applies to" scope={d.scope} onChange={(scope) => upD(d.id, { scope })} taxonomy={taxonomy} brands={brands} allowAll />
                      <ScopeEditor label="Except (optional)" scope={d.exclude} onChange={(exclude) => upD(d.id, { exclude })} taxonomy={taxonomy} brands={brands} />
                      <div className="grid gap-4 md:grid-cols-3">
                        <Text label="Coupon code (empty = automatic)" value={d.code} onChange={(code) => upD(d.id, { code: code.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} placeholder="e.g. WELCOME10" />
                        <Num label="Minimum spend ($)" hint="0 = none" value={d.minSubtotal} onChange={(minSubtotal) => upD(d.id, { minSubtotal })} />
                        {d.code && <Num label="Max uses (0 = unlimited)" value={d.usageLimit} onChange={(usageLimit) => upD(d.id, { usageLimit })} />}
                        <Text type="datetime-local" label="Starts" hint="Empty = now" value={d.startsAt ? local(d.startsAt) : ""} onChange={(v) => upD(d.id, { startsAt: v ? new Date(v).toISOString() : "" })} />
                        <Text type="datetime-local" label="Ends" hint="Empty = no end" value={d.endsAt ? local(d.endsAt) : ""} onChange={(v) => upD(d.id, { endsAt: v ? new Date(v).toISOString() : "" })} />
                      </div>
                      {d.code && <Toggle label="Also applies to items already on sale" checked={d.stack} onChange={(stack) => upD(d.id, { stack })} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title="Free gifts with purchase"
          sub="When the cart reaches the spend, the customer picks their gift in the cart. Below the spend they see “Spend $X more to get…”. Gifts are added to the order at $0."
          actions={<button onClick={() => { const g = newGift(); set({ ...p, gifts: [...p.gifts, g] }); setOpen(g.id); }} className="rounded-lg bg-ink px-3 py-1.5 text-sm text-white">+ New gift level</button>}
        >
          {p.gifts.length === 0 && <p className="text-sm text-muted">Example: spend $50 → choose 1 travel-size product; spend $100 → choose 2. You can limit the spend to a brand, e.g. “Spend $40 on Vichy, get a free mini serum”.</p>}
          <ul className="space-y-2">
            {[...p.gifts].sort((a, b) => a.minSubtotal - b.minSubtotal).map((g) => {
              const [st, cls] = status(g);
              return (
                <li key={g.id} className="rounded-lg border border-line">
                  <div className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{st}</span>
                    <button onClick={() => setOpen(open === g.id ? null : g.id)} className="flex-1 text-left text-sm">
                      <b>{g.name}</b>
                      <span className="ml-2 text-muted">spend ${g.minSubtotal}{g.scope.kind !== "all" ? ` on ${scopeText(g.scope, taxonomy)}` : ""} · choose {g.pick} of {g.choices.length}</span>
                    </button>
                    <Toggle label="" checked={g.enabled} onChange={(enabled) => upG(g.id, { enabled })} />
                    <button onClick={() => window.confirm("Delete this gift level?") && set({ ...p, gifts: p.gifts.filter((x) => x.id !== g.id) })} className="text-sm text-sale">Delete</button>
                  </div>
                  {open === g.id && (
                    <div className="space-y-4 border-t border-line p-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <Text label="Name (shown in cart)" value={g.name} onChange={(name) => upG(g.id, { name })} />
                        <Num label="Spend at least ($)" value={g.minSubtotal} onChange={(minSubtotal) => upG(g.id, { minSubtotal })} />
                        <Num label="Gifts the customer may choose" min={1} value={g.pick} onChange={(pick) => upG(g.id, { pick: Math.max(1, Math.min(10, pick)) })} />
                      </div>
                      <ScopeEditor label="Spend counted on" scope={g.scope} onChange={(scope) => upG(g.id, { scope })} taxonomy={taxonomy} brands={brands} allowAll />
                      <ProductPicker label="Gift options" hint="Add the products customers can choose from. Sold-out gifts are greyed out automatically." value={g.choices} onChange={(choices) => upG(g.id, { choices })} max={30} />
                      <div className="grid gap-4 md:grid-cols-3">
                        <Text type="datetime-local" label="Starts" hint="Empty = now" value={g.startsAt ? local(g.startsAt) : ""} onChange={(v) => upG(g.id, { startsAt: v ? new Date(v).toISOString() : "" })} />
                        <Text type="datetime-local" label="Ends" hint="Empty = no end" value={g.endsAt ? local(g.endsAt) : ""} onChange={(v) => upG(g.id, { endsAt: v ? new Date(v).toISOString() : "" })} />
                        <Toggle label="Show “spend $X more” message" checked={g.showProgress} onChange={(showProgress) => upG(g.id, { showProgress })} />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}

const local = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function scopeText(s: Scope, tax: Taxonomy) {
  if (s.kind === "all") return "everything";
  const names = s.values.map((v) => (s.kind === "category" ? tax.categories.find((c) => c.slug === v)?.name : s.kind === "concern" ? tax.concerns.find((c) => c.slug === v)?.name : s.kind === "tag" ? tagLabels[v as keyof typeof tagLabels] : v) ?? v);
  return names.length ? (names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ")) : `(no ${s.kind} chosen)`;
}

function ScopeEditor({ label, scope, onChange, taxonomy, brands, allowAll = false }: { label: string; scope: Scope; onChange: (s: Scope) => void; taxonomy: Taxonomy; brands: string[]; allowAll?: boolean }) {
  const [q, setQ] = useState("");
  const opts: [Scope["kind"], string][] = [
    ...(allowAll ? ([["all", "Everything"]] as [Scope["kind"], string][]) : []),
    ["brand", "Brands"], ["category", "Categories"], ["concern", "Concerns"], ["tag", "Badges"], ["skus", "Specific products"],
  ];
  return (
    <div className="rounded-lg bg-[#fafafa] p-3">
      <Select label={label} value={scope.kind} onChange={(kind) => onChange({ kind, values: [] })} options={opts} className="max-w-xs" />
      <div className="mt-3">
        {scope.kind === "category" && <Chips label="" options={taxonomy.categories.map((c) => ({ value: c.slug, label: c.name }))} value={scope.values} onChange={(values) => onChange({ ...scope, values })} />}
        {scope.kind === "concern" && <Chips label="" options={taxonomy.concerns.map((c) => ({ value: c.slug, label: c.name }))} value={scope.values} onChange={(values) => onChange({ ...scope, values })} />}
        {scope.kind === "tag" && <Chips label="" options={TAGS.map((t) => ({ value: t, label: tagLabels[t] }))} value={scope.values} onChange={(values) => onChange({ ...scope, values })} />}
        {scope.kind === "skus" && <ProductPicker label="" value={scope.values} onChange={(values) => onChange({ ...scope, values })} max={500} />}
        {scope.kind === "brand" && (
          <div className="text-sm">
            <div className="mb-2 flex flex-wrap gap-1.5">{scope.values.map((b) => <button key={b} onClick={() => onChange({ ...scope, values: scope.values.filter((x) => x !== b) })} className="rounded-full bg-brand-500 px-2.5 py-1 text-xs text-white">{b} ✕</button>)}</div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to find a brand…" className="w-full rounded-lg border border-line px-3 py-2" />
            {q && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {brands.filter((b) => b.toLowerCase().includes(q.toLowerCase())).slice(0, 30).map((b) => (
                  <button key={b} onClick={() => { if (!scope.values.includes(b)) onChange({ ...scope, values: [...scope.values, b] }); setQ(""); }} className="rounded-full border border-line bg-white px-2.5 py-1 text-xs hover:border-brand-500">{b}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Margin room next to a % discount: green when every brand it covers can take it, amber when it gets capped.
function RoomHint({ d, room }: { d: Promotions["discounts"][number]; room: Record<string, number | null> }) {
  const brands = d.scope.kind === "brand" ? d.scope.values.map((v) => v.toLowerCase()) : d.scope.kind === "all" ? Object.keys(room) : [];
  const known = brands.map((b) => room[b]).filter((r): r is number => typeof r === "number");
  if (!known.length) return d.scope.kind === "all" || d.scope.kind === "brand" ? null : <span className="basis-full text-xs text-muted">Capped item by item at the minimum margin.</span>;
  const low = Math.min(...known);
  const over = known.filter((r) => r < d.value).length;
  return over === 0
    ? <span className="basis-full text-xs text-emerald-700">Fits the margin room{brands.length === 1 ? ` (up to ${low}%)` : ""}.</span>
    : <span className="basis-full text-xs text-amber-800">{brands.length === 1 ? `Margin room is ${low}%: customers get ${low}%, not ${d.value}%.` : `${over} of ${known.length} brands have less room than ${d.value}% (lowest ${low}%): those are capped at their room.`}</span>;
}
