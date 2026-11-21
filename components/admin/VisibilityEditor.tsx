"use client";

import { useEffect, useState } from "react";
import { imgUrl } from "@/lib/img";
import type { Visibility } from "@/lib/site-store";
import { Card, Header, Toggle, useSaver } from "./fields";

const label = (s: string) => ({ "neovitale.com": "Neovitale catalog", "skinsociety.me": "Skin Society catalog", manual: "Added by hand / CSV" } as Record<string, string>)[s] ?? s;

type Found = { sku: string; slug: string; name: string; brand: string; variant?: string; price: number; image?: string; inStock: boolean; status?: string; id?: string };

export function VisibilityEditor({ initial, sources, brands }: { initial: Visibility; sources: { name: string; items: number; active: number }[]; brands: { name: string; items: number; sources: string[] }[] }) {
  const [v, setV] = useState(initial);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "hidden" | string>("all");
  const saver = useSaver("/api/admin/visibility/");
  const hidS = new Set(v.hiddenSources.map((x) => x.toLowerCase()));
  const hidB = new Set(v.hiddenBrands.map((x) => x.toLowerCase()));
  const toggleSource = (s: string, on: boolean) => (saver.touch(), setV({ ...v, hiddenSources: on ? v.hiddenSources.filter((x) => x.toLowerCase() !== s.toLowerCase()) : [...v.hiddenSources, s] }));
  const toggleBrand = (b: string, on: boolean) => (saver.touch(), setV({ ...v, hiddenBrands: on ? v.hiddenBrands.filter((x) => x.toLowerCase() !== b.toLowerCase()) : [...v.hiddenBrands, b] }));
  const shown = brands.filter((b) => (!q || b.name.toLowerCase().includes(q.toLowerCase())) && (only === "all" || (only === "hidden" ? hidB.has(b.name.toLowerCase()) : b.sources.includes(only))));

  return (
    <div>
      <Header title="Catalog visibility" sub="Switch whole catalogs, brands or single products on and off. Hidden items disappear from the shop, search, menus and carts but stay in the admin." saver={saver} onSave={() => saver.save(v)} />
      <div className="space-y-5">
        <Card title="Catalogs">
          <div className="grid gap-3 md:grid-cols-3">
            {sources.map((s) => {
              const on = !hidS.has(s.name.toLowerCase());
              return (
                <div key={s.name} className={`rounded-xl border p-4 ${on ? "border-line" : "border-dashed border-sale/50 bg-red-50/40"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{label(s.name)}</p>
                      <p className="text-xs text-muted">{s.name} · {s.items.toLocaleString("en-US")} items · {s.active.toLocaleString("en-US")} variants active</p>
                    </div>
                    <Toggle label="" checked={on} onChange={(x) => toggleSource(s.name, x)} />
                  </div>
                  <p className={`mt-2 text-xs font-semibold ${on ? "text-green-700" : "text-sale"}`}>{on ? "Shown in the shop" : "Hidden from the shop"}</p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card
          title={`Brands (${brands.length.toLocaleString("en-US")} · ${v.hiddenBrands.length} hidden)`}
          actions={
            <div className="flex flex-wrap gap-2 text-sm">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a brand…" className="w-48 rounded-lg border border-line px-3 py-1.5" />
              <select value={only} onChange={(e) => setOnly(e.target.value)} className="rounded-lg border border-line px-2">
                <option value="all">All brands</option>
                <option value="hidden">Hidden only</option>
                {sources.map((s) => <option key={s.name} value={s.name}>From {label(s.name)}</option>)}
              </select>
            </div>
          }
        >
          <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.slice(0, 600).map((b) => {
              const on = !hidB.has(b.name.toLowerCase());
              const viaSource = b.sources.every((s) => hidS.has(s.toLowerCase()));
              return (
                <label key={b.name} className="flex items-center gap-2 border-b border-line py-1.5 text-sm">
                  <input type="checkbox" checked={on} onChange={(e) => toggleBrand(b.name, e.target.checked)} />
                  <span className={`flex-1 truncate ${on && !viaSource ? "" : "text-muted line-through"}`}>{b.name}</span>
                  <span className="text-xs text-muted">{b.items}</span>
                </label>
              );
            })}
          </div>
          {shown.length > 600 && <p className="mt-2 text-xs text-muted">Showing 600 of {shown.length} — use the search box.</p>}
          {shown.length > 0 && (
            <div className="mt-3 flex gap-2 text-sm">
              <button onClick={() => (saver.touch(), setV({ ...v, hiddenBrands: Array.from(new Set([...v.hiddenBrands, ...shown.map((b) => b.name)])) }))} className="rounded-lg border border-line px-3 py-1.5">Hide all {shown.length} shown</button>
              <button onClick={() => { const names = new Set(shown.map((b) => b.name.toLowerCase())); saver.touch(); setV({ ...v, hiddenBrands: v.hiddenBrands.filter((x) => !names.has(x.toLowerCase())) }); }} className="rounded-lg border border-line px-3 py-1.5">Show all {shown.length} shown</button>
            </div>
          )}
        </Card>

        <ProductSwitch />
      </div>
    </div>
  );
}

/** Turn single products on/off (sets the product to Active or Draft immediately). */
function ProductSwitch() {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<(Found & { id: string; status: string })[]>([]);
  const [busy, setBusy] = useState("");
  const load = () => fetch(`/api/admin/visibility/products/?q=${encodeURIComponent(q)}`).then((r) => r.json()).then(setFound).catch(() => {});
  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  async function set(ids: string[], on: boolean) {
    setBusy(ids.join());
    await fetch("/api/admin/products/", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: on ? "activate" : "draft", ids }) });
    await load();
    setBusy("");
  }
  return (
    <Card title="Single products" sub="Search, then switch a product on or off. Changes apply immediately (no Save needed).">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, brand or SKU…" className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
      {found.length > 0 && (
        <>
          <div className="mt-2 flex gap-2 text-xs">
            <button onClick={() => set(found.map((f) => f.id), false)} className="rounded border border-line px-2 py-1">Turn all {found.length} off</button>
            <button onClick={() => set(found.map((f) => f.id), true)} className="rounded border border-line px-2 py-1">Turn all {found.length} on</button>
          </div>
          <ul className="mt-2 divide-y divide-line text-sm">
            {found.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image ? <img src={imgUrl(p.image, 64)} alt="" className="h-9 w-9 rounded object-contain" /> : <span className="h-9 w-9 rounded bg-brand-50" />}
                <span className="min-w-0 flex-1 truncate"><b>{p.brand}</b> · {p.name}{p.variant ? ` · ${p.variant}` : ""} <span className="font-mono text-[10px] text-muted">{p.sku}</span></span>
                <span className="text-xs">${p.price.toFixed(2)}</span>
                <Toggle label="" checked={p.status === "active"} onChange={(on) => busy || set([p.id], on)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
