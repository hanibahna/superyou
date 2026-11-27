"use client";

import { useState } from "react";
import type { Candidate } from "@/lib/black-friday";

type Item = Partial<Candidate> & { slug: string; pct: number };
type Init = { items: Item[]; startsAt: string; endsAt: string; enabled: boolean; headline: boolean };

const local = (iso: string) => (iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Beirut" }).slice(0, 16).replace(" ", "T") : "");
const toIso = (v: string) => (v ? new Date(`${v}:00+02:00`).toISOString() : "");
const after = (price = 0, d = 0) => Math.round(price * (1 - d / 100) * 100) / 100;
const marginAfter = (price?: number, cost?: number, d = 0) => (price && cost ? Math.round(((after(price, d) - cost) / after(price, d)) * 1000) / 10 : null);
const tone = (m: number | null) => (m === null ? "text-muted" : m < 0 ? "text-sale font-semibold" : m < 10 ? "text-amber-600" : "text-green-700");

function Margin({ c, d }: { c: Partial<Candidate>; d: number }) {
  const m = marginAfter(c.price, c.cost, d);
  return (
    <div className="text-right text-xs leading-tight">
      <div>Max margin <b className={tone(c.maxMarginPct ?? null)}>{c.maxMarginPct === null || c.maxMarginPct === undefined ? "no cost" : `${c.maxMarginPct}%`}</b></div>
      {d > 0 && <div>After −{d}%: <b className={tone(m)}>{m === null ? "?" : `${m}%`}</b> · ${after(c.price, d)}</div>}
    </div>
  );
}

export function BannerPicker({ initial }: { initial: Init }) {
  const [items, setItems] = useState<Item[]>(initial.items);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [start, setStart] = useState(local(initial.startsAt) || "2026-11-27T00:00");
  const [end, setEnd] = useState(local(initial.endsAt) || "2026-12-01T23:59");
  const [enabled, setEnabled] = useState(initial.enabled);
  const [headline, setHeadline] = useState(initial.headline);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!q.trim()) return;
    const r = await fetch(`/api/admin/black-friday/?search=${encodeURIComponent(q)}`);
    setResults(r.ok ? await r.json() : []);
  };
  const add = (c: Candidate) => { if (!items.some((i) => i.slug === c.slug) && items.length < 24) setItems([...items, { ...c, pct: draft[c.slug] ?? 0 }]); };
  const move = (i: number, by: number) => { const n = [...items]; const [x] = n.splice(i, 1); n.splice(Math.max(0, Math.min(n.length, i + by)), 0, x); setItems(n); };
  const save = async () => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/admin/black-friday/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ banner: { items: items.map(({ slug, pct }) => ({ slug, pct })), startsAt: toIso(start), endsAt: toIso(end), enabled, headline } }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? `Saved: ${j.items} products in the banner, ${j.discounts} with a discount${headline ? `; headline now "${j.headline ? `Up to ${j.headline}% off` : "Our Black Friday picks"}"` : ""}.` : j.error ?? "Could not save");
  };
  const below = items.filter((i) => { const m = marginAfter(i.price, i.cost, i.pct); return m !== null && m < 0; }).length;

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <div>
        <h1 className="text-2xl font-semibold">Black Friday banner</h1>
        <p className="text-sm text-muted">Pick the products shown in the homepage Black Friday banner and the discount on each. The first 6 become the picture tiles; 4 or more also run as the sliding product row. Max margin = our regular price minus cost, before any discount.</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">Starts (Beirut)<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block rounded-lg border border-line px-3 py-2" /></label>
        <label className="text-sm">Ends<input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 block rounded-lg border border-line px-3 py-2" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Discounts on</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={headline} onChange={(e) => setHeadline(e.target.checked)} /> Headline says the real biggest discount</label>
        <button disabled={busy} onClick={save} className="rounded-lg bg-brand-500 px-5 py-2 font-semibold text-white">Save banner</button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}

      <div>
        <h2 className="font-semibold">In the banner ({items.length}){below ? <span className="text-sale"> · {below} below cost</span> : null}</h2>
        <ul className="mt-2 divide-y divide-line">
          {items.map((it, i) => (
            <li key={it.slug} className="flex items-center gap-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {it.image ? <img src={it.image} alt="" className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-line" />}
              <div className="min-w-0 flex-1 text-sm"><div className="truncate font-medium">{it.brand} · {it.name}</div><div className="text-xs text-muted">${it.price}{it.cost ? ` · cost $${it.cost}` : " · cost unknown"}{i < 6 ? " · picture tile" : ""}{it.inStock === false ? " · sold out" : ""}</div></div>
              <label className="text-xs">Discount %<input type="number" min={0} max={90} value={it.pct || ""} placeholder="0" onChange={(e) => setItems(items.map((x) => (x.slug === it.slug ? { ...x, pct: Math.max(0, Math.min(90, Number(e.target.value) || 0)) } : x)))} className="ml-1 w-16 rounded border border-line px-2 py-1 text-right" /></label>
              <Margin c={it} d={it.pct} />
              <div className="flex flex-col text-xs"><button onClick={() => move(i, -1)}>▲</button><button onClick={() => move(i, 1)}>▼</button></div>
              <button onClick={() => setItems(items.filter((x) => x.slug !== it.slug))} className="text-xs text-sale">Remove</button>
            </li>
          ))}
          {!items.length && <li className="py-2 text-sm text-muted">No products yet. Search below to add some.</li>}
        </ul>
      </div>

      <div>
        <h2 className="font-semibold">Add products</h2>
        <div className="mt-2 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Brand or product, e.g. La Roche-Posay Anthelios" className="w-96 rounded-lg border border-line px-3 py-2 text-sm" />
          <button onClick={search} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold">Search</button>
        </div>
        <ul className="mt-2 divide-y divide-line">
          {results.map((c) => {
            const d = draft[c.slug] ?? 0;
            const inBanner = items.some((i) => i.slug === c.slug);
            return (
              <li key={c.slug} className="flex items-center gap-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.image ? <img src={c.image} alt="" className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-line" />}
                <div className="min-w-0 flex-1 text-sm"><div className="truncate font-medium">{c.brand} · {c.name}</div><div className="text-xs text-muted">${c.price}{c.cost ? ` · cost $${c.cost}` : " · cost unknown"}{c.variants > 1 ? ` · ${c.variants} sizes/shades` : ""}{c.inStock ? "" : " · sold out"}</div></div>
                <label className="text-xs">Discount %<input type="number" min={0} max={90} value={d || ""} placeholder="0" onChange={(e) => setDraft({ ...draft, [c.slug]: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })} className="ml-1 w-16 rounded border border-line px-2 py-1 text-right" /></label>
                <Margin c={c} d={d} />
                <button disabled={inBanner} onClick={() => add(c)} className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">{inBanner ? "Added" : "Add"}</button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
