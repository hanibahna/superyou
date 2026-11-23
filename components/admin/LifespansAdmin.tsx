"use client";

import { useState } from "react";
import { Card } from "./fields";

type Life = { days: number; every: number; basis: string; by: string } | null;
type Row = { slug: string; name: string; size: string; category: string; life: Life };

const planLabel = (e?: number) => (e === undefined ? "—" : e === 0 ? "No subscription" : e === 1 ? "Every month" : `Every ${e} months`);

export function LifespansAdmin({ rows, stats, totalProducts, q, plan }: { rows: Row[]; stats: { total: number; by: Record<string, number> }; totalProducts: number; q: string; plan: string }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Record<string, { days: number; sub: boolean }>>({});
  const missing = Math.max(0, totalProducts - stats.total);
  async function build() {
    setBusy(true);
    let saved = 0;
    for (let i = 0; i < 60; i++) {
      const r = await fetch("/api/admin/lifespans/?calls=24", { method: "POST" }).then((x) => x.json()).catch(() => null);
      if (!r) { setMsg(`Stopped after ${saved} products (connection). Press again to continue.`); break; }
      saved += r.saved ?? 0;
      setMsg(`Estimated ${saved} products… ${r.remaining} to go`);
      if (!r.remaining || !r.saved) break;
    }
    setBusy(false);
  }
  async function redo() {
    setBusy(true);
    const r = await fetch(`/api/admin/lifespans/?calls=40&q=${encodeURIComponent(q)}`, { method: "POST" }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    setMsg(r ? `Re-estimated ${r.saved} products matching "${q}". Reload to see them.` : "Try again.");
  }
  async function save(slug: string) {
    const e = edit[slug];
    const r = await fetch("/api/admin/lifespans/", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, days: e.days, sub: e.sub }) }).then((x) => x.json());
    setMsg(r.ok ? `Saved: ${planLabel(r.every)}` : r.error);
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold">How long products last</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">AI estimates how many days each product lasts with normal use, from its type and size. That sets its Subscribe &amp; save frequency (every 1, 2, 3, 4 or 6 months), when the restock reminder goes out, and whether a subscription is offered at all (not for perfumes, devices, gift sets or colour make-up). Correct any product below; your value wins.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Card title="Estimated"><p className="text-3xl font-bold">{stats.total.toLocaleString()} <span className="text-base font-normal text-muted">/ {totalProducts.toLocaleString()}</span></p></Card>
        <Card title="Monthly / 2–3 months"><p className="text-3xl font-bold">{(stats.by["1"] ?? 0).toLocaleString()} / {((stats.by["2"] ?? 0) + (stats.by["3"] ?? 0)).toLocaleString()}</p></Card>
        <Card title="4–6 months"><p className="text-3xl font-bold">{((stats.by["4"] ?? 0) + (stats.by["6"] ?? 0)).toLocaleString()}</p></Card>
        <Card title="No subscription"><p className="text-3xl font-bold">{(stats.by.no ?? 0).toLocaleString()}</p></Card>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={build} disabled={busy || !missing} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Estimating…" : missing ? `Estimate the ${missing.toLocaleString()} missing products` : "All products estimated"}</button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
      <form className="mt-5 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search products" className="rounded-lg border border-line px-3 py-2 text-sm" />
        <select name="plan" defaultValue={plan} className="rounded-lg border border-line px-3 py-2 text-sm">
          <option value="">All plans</option>{["1", "2", "3", "4", "6"].map((e) => <option key={e} value={e}>{planLabel(+e)}</option>)}<option value="no">No subscription</option><option value="none">Not estimated yet</option>
        </select>
        <button className="rounded-lg border border-line px-3 py-2 text-sm">Filter</button>
        {q && <button type="button" onClick={redo} disabled={busy} className="rounded-lg border border-line px-3 py-2 text-sm">Re-estimate matching products with AI</button>}
      </form>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead><tr className="text-left text-muted"><th className="py-2">Product</th><th>Lasts</th><th>Plan</th><th>Why</th><th>Correct it</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const e = edit[r.slug] ?? { days: r.life?.days ?? 30, sub: (r.life?.every ?? 1) > 0 };
              return (
                <tr key={r.slug} className="align-top">
                  <td className="py-2"><a href={`/products/${r.slug}/`} target="_blank" rel="noreferrer" className="underline">{r.name}</a><br /><span className="text-xs text-muted">{r.size} · {r.category}</span></td>
                  <td className="py-2">{r.life ? `${r.life.days} days` : "—"}</td>
                  <td className="py-2">{planLabel(r.life?.every)}{r.life?.by === "admin" && <span className="ms-1 text-xs text-muted">(you)</span>}</td>
                  <td className="max-w-[220px] py-2 text-xs text-muted">{r.life?.basis}</td>
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <input type="number" min={1} max={3650} value={e.days} onChange={(x) => setEdit({ ...edit, [r.slug]: { ...e, days: +x.target.value } })} className="w-20 rounded border border-line px-2 py-1" aria-label="Days it lasts" />
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={e.sub} onChange={(x) => setEdit({ ...edit, [r.slug]: { ...e, sub: x.target.checked } })} />subscribe</label>
                      <button onClick={() => save(r.slug)} disabled={!edit[r.slug]} className="rounded border border-line px-2 py-1 text-xs disabled:opacity-40">Save</button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 200 && <p className="mt-2 text-xs text-muted">Showing the first 200: search or filter to find others.</p>}
      </div>
    </div>
  );
}
