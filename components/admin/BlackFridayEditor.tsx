"use client";

import { useMemo, useState } from "react";
import type { BfLine } from "@/lib/black-friday";

type State = { startsAt: string; endsAt: string; enabled: boolean; pct: Record<string, number> };
type Banner = { headline: string; onSaleNow: number; rows: { pageWorks?: boolean; problem?: string; alternative?: string; banner: string; name: string; brand: string; source: string; neovitale: boolean; regular: number; was?: number; now: number; offPct: number; basis: string; cost?: number; marginNowPct: number | null }[] };

const local = (iso: string) => (iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Beirut" }).slice(0, 16).replace(" ", "T") : "");
const toIso = (v: string) => (v ? new Date(`${v}:00+02:00`).toISOString() : "");
const tone = (m: number | null) => (m === null ? "text-muted" : m < 0 ? "text-sale font-semibold" : m < 10 ? "text-amber-600" : "text-green-700");

export function BlackFridayEditor({ state, lines, banner }: { state: State; lines: BfLine[]; banner: Banner }) {
  const [pct, setPct] = useState<Record<string, number>>(Object.fromEntries(lines.map((l) => [l.brand, state.pct[l.brand.toLowerCase()] ?? 0])));
  const [start, setStart] = useState(local(state.startsAt) || "2026-11-27T00:00");
  const [end, setEnd] = useState(local(state.endsAt) || "2026-12-01T23:59");
  const [enabled, setEnabled] = useState(state.enabled);
  const [q, setQ] = useState("");
  const [onlyOn, setOnlyOn] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => lines.map((l) => {
    const d = pct[l.brand] ?? 0;
    const after = l.regular * (1 - d / 100);
    return { ...l, d, m: after && l.withCost ? Math.round(((after - l.cost) / after) * 1000) / 10 : null };
  }).filter((l) => (!q || l.brand.toLowerCase().includes(q.toLowerCase())) && (!onlyOn || l.d > 0)), [lines, pct, q, onlyOn]);
  const on = Object.values(pct).filter((v) => v > 0).length;
  const losing = rows.filter((r) => r.m !== null && r.m < 0).length;

  const save = async () => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/admin/black-friday/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startsAt: toIso(start), endsAt: toIso(end), enabled, pct: Object.fromEntries(Object.entries(pct).filter(([, v]) => v > 0)) }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? `Saved: ${j.lines} lines ${enabled ? "on sale" : "set up (switched off)"}. Prices update within a minute.` : j.error ?? "Could not save");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Discount by product line</h2>
        <p className="text-sm text-muted">Set a discount per product line (brand). It shows as a sale price across the shop, cart and app between the dates below. Margin = (price − cost) ÷ price, on products with a known cost.</p>
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Homepage Black Friday banner: what it shows now</h2>
        <p className="text-sm text-muted">Headline: <b>{banner.headline || "none"}</b> · products on sale in the shop right now: <b>{banner.onSaleNow}</b>{banner.onSaleNow === 0 ? <span className="text-sale"> (the headline promises a discount nothing has yet)</span> : null}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted"><th className="py-1 pr-2">Where</th><th className="pr-2">Product</th><th className="pr-2">Catalog</th><th className="pr-2 text-right">Was</th><th className="pr-2 text-right">Now</th><th className="pr-2 text-right">Off</th><th className="pr-2 text-right">Cost</th><th className="pr-2 text-right">Margin</th><th>Discount basis</th></tr></thead>
            <tbody>{banner.rows.map((b, i) => (
              <tr key={i} className="border-t border-line align-top">
                <td className="py-1 pr-2 text-xs text-muted">{b.banner}</td>
                <td className="pr-2">{b.brand} · {b.name}{b.problem ? <span className="block text-xs text-sale">Link broken: {b.problem}{b.alternative ? ` · live alternative ${b.alternative}` : " · no live alternative"}</span> : null}</td>
                <td className={`pr-2 ${b.neovitale ? "" : "font-semibold text-amber-700"}`}>{b.source}</td>
                <td className="pr-2 text-right">{b.was ? `$${b.was}` : "—"}</td>
                <td className="pr-2 text-right">${b.now}</td>
                <td className="pr-2 text-right">{b.offPct ? `${b.offPct}%` : "—"}</td>
                <td className="pr-2 text-right">{b.cost ? `$${b.cost}` : "unknown"}</td>
                <td className={`pr-2 text-right ${tone(b.marginNowPct)}`}>{b.marginNowPct === null ? "—" : `${b.marginNowPct}%`}</td>
                <td className="text-xs">{b.basis}</td>
              </tr>))}
              {!banner.rows.length && <tr><td colSpan={9} className="py-2 text-muted">The banner has no product slider switched on.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">Starts (Beirut time)<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block rounded-lg border border-line px-3 py-2" /></label>
          <label className="text-sm">Ends<input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 block rounded-lg border border-line px-3 py-2" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Sale switched on</label>
          <button disabled={busy} onClick={save} className="rounded-lg bg-brand-500 px-5 py-2 font-semibold text-white">Save Black Friday</button>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
        <p className="text-sm">{on} lines with a discount{losing ? <span className="text-sale"> · {losing} would sell below cost</span> : null}</p>
        <div className="flex flex-wrap gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a brand" className="w-60 rounded-lg border border-line px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyOn} onChange={(e) => setOnlyOn(e.target.checked)} /> Only lines with a discount</label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted"><th className="py-1 pr-2">Line</th><th className="pr-2 text-right">In stock</th><th className="pr-2">Catalogs</th><th className="pr-2 text-right">With cost</th><th className="pr-2 text-right">Margin now</th><th className="pr-2 text-right">Black Friday %</th><th className="pr-2 text-right">Margin after</th></tr></thead>
            <tbody>{rows.slice(0, 400).map((l) => (
              <tr key={l.brand} className="border-t border-line">
                <td className="py-1 pr-2 font-medium">{l.brand}</td>
                <td className="pr-2 text-right">{l.inStock}/{l.products}</td>
                <td className="pr-2 text-xs text-muted">{Object.entries(l.sources).map(([s, n]) => `${s} ${n}`).join(" · ")}</td>
                <td className="pr-2 text-right">{l.withCost}</td>
                <td className={`pr-2 text-right ${tone(l.marginPct)}`}>{l.marginPct === null ? "no cost" : `${l.marginPct}%`}</td>
                <td className="pr-2 text-right"><input type="number" min={0} max={90} step={1} value={l.d || ""} placeholder="0" onChange={(e) => setPct({ ...pct, [l.brand]: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })} className="w-20 rounded border border-line px-2 py-1 text-right" /></td>
                <td className={`pr-2 text-right ${tone(l.m)}`}>{l.m === null ? "—" : `${l.m}%`}{l.d > 0 && l.belowCost ? <span className="block text-xs text-sale">{l.belowCost} below cost</span> : null}</td>
              </tr>))}</tbody>
          </table>
          {rows.length > 400 && <p className="mt-2 text-xs text-muted">Showing 400 of {rows.length}; search to find a brand.</p>}
        </div>
      </section>
    </div>
  );
}
