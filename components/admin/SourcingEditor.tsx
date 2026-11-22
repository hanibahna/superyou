"use client";

import { useState } from "react";
import { landed, type Sourcing, type SourceRule } from "@/lib/sourcing";
import { Card, Header, Toggle, useSaver } from "./fields";

type Stat = { name: string; items: number; inStock: number };
const num = (v: string) => (v === "" ? 0 : Number(v));
const input = "w-full rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-brand-500";

export function SourcingEditor({ initial, stats }: { initial: Sourcing; stats: Stat[] }) {
  const [s, setS] = useState(initial);
  const saver = useSaver("/api/admin/sourcing/");
  const known = new Set(s.sources.map((x) => x.source.toLowerCase()));
  const rows: SourceRule[] = [...s.sources, ...stats.filter((x) => !known.has(x.name.toLowerCase()) && x.name !== "manual").map((x) => ({ source: x.name, label: x.name, origin: "local" as const, country: "Lebanon", daysMin: s.local.daysMin, daysMax: s.local.daysMax }))];
  const put = (i: number, patch: Partial<SourceRule>) => {
    saver.touch();
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    setS({ ...s, sources: next });
  };
  const [sample, setSample] = useState(10);

  return (
    <div>
      <Header title="Sourcing: local & international" sub="Say which catalogs are local stock (ship from Lebanon) and which are international drop shipping. Delivery times show on every product, in the bag and at checkout; international prices are built from the supplier's price on import." saver={saver} onSave={() => saver.save({ ...s, sources: rows })} />
      <div className="space-y-5">
        <Card title="Rules">
          <Toggle label="Prefer local stock" hint="When the same product is in a local and an international catalog, the shop shows the local one (the imported one stays as a back-up when local is sold out)." checked={s.preferLocal} onChange={(v) => (saver.touch(), setS({ ...s, preferLocal: v }))} />
        </Card>
        {rows.map((r, i) => {
          const st = stats.find((x) => x.name.toLowerCase() === r.source.toLowerCase());
          const intl = r.origin === "international";
          const p = r.pricing;
          const ex = intl && p ? landed(sample, p) : null;
          return (
            <Card key={r.source} title={r.label || r.source} sub={`${r.source}${st ? ` · ${st.items.toLocaleString("en-US")} products · ${st.inStock.toLocaleString("en-US")} in stock` : " · not imported yet"}`}>
              <div className="grid gap-3 md:grid-cols-6">
                <label className="md:col-span-2 text-xs font-semibold">Internal name<input className={input} value={r.label} onChange={(e) => put(i, { label: e.target.value })} /></label>
                <label className="text-xs font-semibold">Type
                  <select className={input} value={r.origin} onChange={(e) => put(i, { origin: e.target.value as SourceRule["origin"], pricing: e.target.value === "international" ? r.pricing ?? { freightPerItem: 4, dutyPct: 15, feePct: 3, vatPct: 11, clearancePerItem: 1, marginPct: 35 } : r.pricing })}>
                    <option value="local">Local stock</option>
                    <option value="international">International drop shipping</option>
                  </select>
                </label>
                <label className="text-xs font-semibold">Ships from<input className={input} value={r.country} onChange={(e) => put(i, { country: e.target.value })} /></label>
                <label className="text-xs font-semibold">Days (min)<input className={input} inputMode="numeric" value={r.daysMin} onChange={(e) => put(i, { daysMin: num(e.target.value) })} /></label>
                <label className="text-xs font-semibold">Days (max)<input className={input} inputMode="numeric" value={r.daysMax} onChange={(e) => put(i, { daysMax: num(e.target.value) })} /></label>
              </div>
              {intl && p && (
                <div className="mt-4 rounded-xl bg-[#f7f7fb] p-4">
                  <p className="mb-2 text-sm font-semibold">Import pricing (applied when this catalog is imported)</p>
                  <div className="grid gap-3 md:grid-cols-6">
                    {([["freightPerItem", "Freight $/item"], ["dutyPct", "Customs duty %"], ["feePct", "Extra customs fee %"], ["vatPct", "VAT %"], ["clearancePerItem", "Clearance $/item"], ["marginPct", "Our margin %"]] as const).map(([k, l]) => (
                      <label key={k} className="text-xs font-semibold">{l}<input className={input} inputMode="decimal" value={p[k]} onChange={(e) => put(i, { pricing: { ...p, [k]: num(e.target.value) } })} /></label>
                    ))}
                  </div>
                  {ex && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span>Example: supplier price $<input className="mx-1 w-16 rounded border border-line px-1" inputMode="decimal" value={sample} onChange={(e) => setSample(num(e.target.value))} /></span>
                      <span>+ freight ${ex.freight}</span><span>+ duty ${ex.duty}</span><span>+ fee ${ex.fee}</span><span>+ VAT ${ex.vat}</span><span>+ clearance ${ex.clearance}</span>
                      <span className="font-semibold text-ink">= landed ${ex.landed}</span>
                      <span className="font-semibold text-brand-600">→ shop price ${ex.price}</span>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted">Re-import the catalog (Import / export → Import from another store) after changing these numbers to reprice it.</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
