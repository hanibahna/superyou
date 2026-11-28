"use client";

import { useMemo, useState } from "react";
import type { Margins } from "@/lib/margins";
import type { MarginRow } from "@/lib/margins-report";

const tone = (m: number | null | undefined, floor: number) => (m === null || m === undefined ? "text-muted" : m < floor ? "text-sale font-semibold" : "text-green-700");

export function MarginsEditor({ margins, rows, subDefault = 0 }: { margins: Margins; rows: MarginRow[]; subDefault?: number }) {
  const [floor, setFloor] = useState(margins.floorPct);
  const [brandFloors, setBrandFloors] = useState<Record<string, number>>(margins.brandFloors);
  const [rates, setRates] = useState<Record<string, number | null>>(margins.neoRates);
  const [subs, setSubs] = useState<Record<string, number>>(margins.subPct ?? {});
  const [q, setQ] = useState("");
  const [view, setView] = useState<"all" | "missing" | "edited">("all");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => rows.filter((r) => (!q || r.brand.toLowerCase().includes(q.toLowerCase())) && (view === "all" || (view === "missing" ? r.rateFrom === "missing" && !(r.brand in rates) : r.brand in rates))), [rows, q, view, rates]);
  const missing = rows.filter((r) => r.rateFrom === "missing" && !(r.brand in rates)).length;

  const save = async () => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/admin/margins/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ floorPct: floor, brandFloors, neoRates: rates, subPct: subs }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? `Saved.${j.costsUpdated ? ` Costs recalculated for ${j.costsUpdated} products.` : ""} Shop prices follow within a minute.` : j.error ?? "Could not save");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Margins</h1>
        <p className="text-sm text-muted">Margin = (price − cost) ÷ price. NeoVitale items sell at NeoVitale's regular price, so their margin is NeoVitale's discount to us for that brand.</p>
      </div>

      <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Minimum margin (all discounts)</h2>
        <p className="text-sm text-muted">No sale, Black Friday discount, banner discount, coupon or SuperPrice can bring a product under cost + this margin. The discount stops at that price instead. Products with no known cost are not limited.</p>
        <label className="flex items-center gap-2 text-sm">Store-wide minimum margin <input type="number" min={0} max={90} value={floor} onChange={(e) => setFloor(Math.max(0, Math.min(90, Number(e.target.value) || 0)))} className="w-20 rounded border border-line px-2 py-1 text-right" /> %</label>
        <div className="flex items-center gap-3">
          <button disabled={busy} onClick={save} className="rounded-lg bg-brand-500 px-5 py-2 font-semibold text-white">Save margins</button>
          {msg && <span className="text-sm">{msg}</span>}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">By brand</h2>
        <p className="text-sm text-muted">Edit NeoVitale's discount for a brand (our cost updates when you save), give a brand its own minimum margin, or its own auto-replenish (Subscribe & save) discount: empty uses the store-wide %, 0 turns it off for that brand. The minimum margin always wins. {missing} brands have no rate yet: their margin is unknown.</p>
        <div className="flex flex-wrap gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a brand" className="w-60 rounded-lg border border-line px-3 py-2 text-sm" />
          {(["all", "missing", "edited"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`rounded-full border px-3 py-1 text-sm ${view === v ? "border-brand-500 font-semibold" : "border-line"}`}>{v === "all" ? "All" : v === "missing" ? `No rate (${missing})` : "Edited"}</button>)}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted"><th className="py-1 pr-2">Brand</th><th className="pr-2 text-right">In stock</th><th className="pr-2">NeoVitale rate</th><th className="pr-2 text-right">Margin now</th><th className="pr-2">Minimum margin</th><th className="pr-2" title="Subscribe & save discount for this brand. Empty = store-wide %, 0 = no auto-replenish discount.">Auto-replenish %</th></tr></thead>
            <tbody>{shown.slice(0, 500).map((r) => {
              const edited = r.brand in rates;
              const rate = edited ? rates[r.brand] : r.rate;
              const bf = brandFloors[r.brand.toLowerCase()];
              const eff = bf ?? floor;
              const m = edited ? (rate ?? null) : r.marginPct;
              return (
                <tr key={r.brand} className="border-t border-line">
                  <td className="py-1 pr-2 font-medium">{r.brand}</td>
                  <td className="pr-2 text-right">{r.inStock}/{r.products}</td>
                  <td className="pr-2">
                    <input type="number" min={0} max={90} step={0.5} value={rate ?? ""} placeholder={rate === null ? "1+1" : "—"} onChange={(e) => setRates({ ...rates, [r.brand]: e.target.value === "" ? null : Math.max(0, Math.min(90, Number(e.target.value))) })} className="w-20 rounded border border-line px-2 py-1 text-right" /> %
                    <span className="ml-2 text-xs text-muted">{edited ? "edited" : r.rateFrom}</span>
                    {edited && <button onClick={() => { const n = { ...rates }; delete n[r.brand]; setRates(n); }} className="ml-2 text-xs text-sale">undo</button>}
                  </td>
                  <td className={`pr-2 text-right ${tone(m, eff)}`}>{m === null || m === undefined ? "unknown" : `${m}%`}</td>
                  <td className="pr-2">
                    <input type="number" min={0} max={90} value={bf ?? ""} placeholder={`${floor}`} onChange={(e) => { const n = { ...brandFloors }; if (e.target.value === "") delete n[r.brand.toLowerCase()]; else n[r.brand.toLowerCase()] = Math.max(0, Math.min(90, Number(e.target.value))); setBrandFloors(n); }} className="w-16 rounded border border-line px-2 py-1 text-right" /> %
                    {m !== null && m !== undefined && m < eff && <span className="ml-2 text-xs text-sale">margin below the minimum: no discounts possible</span>}
                  </td>
                  <td className="pr-2">
                    {(() => {
                      const k = r.brand.toLowerCase(), sv = subs[k], effSub = sv ?? subDefault;
                      // The minimum margin always wins: show how much of this % customers really get.
                      const room = m === null || m === undefined ? null : Math.max(0, Math.round((m - eff) * 10) / 10);
                      return (
                        <>
                          <input type="number" min={0} max={50} step={0.5} value={sv ?? ""} placeholder={`${subDefault}`} onChange={(e) => { const n = { ...subs }; if (e.target.value === "") delete n[k]; else n[k] = Math.max(0, Math.min(50, Number(e.target.value))); setSubs(n); }} className="w-16 rounded border border-line px-2 py-1 text-right" aria-label={`Auto-replenish discount for ${r.brand}`} />
                          {sv === 0 && <span className="ml-2 text-xs text-muted">off for this brand</span>}
                          {room !== null && effSub > room && <span className="ml-2 text-xs text-sale">only {room}% possible above the minimum margin</span>}
                        </>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
          {shown.length > 500 && <p className="mt-2 text-xs text-muted">Showing 500 of {shown.length}; search to find a brand.</p>}
        </div>
        <button disabled={busy} onClick={save} className="rounded-lg bg-brand-500 px-5 py-2 font-semibold text-white">Save margins</button>
      </section>
    </div>
  );
}
