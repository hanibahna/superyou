"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { slugify, type Category, type Concern, type Taxonomy } from "@/lib/data/catalog";
import { MediaField } from "./fields";

export function TaxonomyEditor({ initial, counts }: { initial: Taxonomy; counts: Record<string, number> }) {
  const router = useRouter();
  const [t, setT] = useState<Taxonomy>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [openCat, setOpenCat] = useState<number | null>(null);
  const upCat = (i: number, patch: Partial<Category>) => setT({ ...t, categories: t.categories.map((x, n) => (n === i ? { ...x, ...patch } : x)) });

  const move = <T,>(arr: T[], i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/taxonomy/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t) });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Saved" } : { ok: false, text: data.error });
    if (res.ok) router.refresh();
  }

  const input = "rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-brand-500";
  const btn = "rounded px-1.5 text-muted hover:bg-line disabled:opacity-30";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Categories & concerns</h1>
          <p className="text-sm text-muted">Order here = order in the shop menu. The slug is the web address part; changing it unlinks existing products.</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-sm ${msg.ok ? "text-brand-600" : "text-sale"}`}>{msg.text}</span>}
          <button onClick={save} disabled={busy} className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">Save changes</button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">Categories (main menu)</h2>
          <ul className="space-y-2">
            {t.categories.map((c, i) => (
              <li key={i} className={c.menu === false ? "opacity-60" : ""}>
                <div className="flex items-center gap-2">
                <input value={c.name} onChange={(e) => setT({ ...t, categories: t.categories.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)) })} className={`${input} flex-1`} />
                <input value={c.slug} onChange={(e) => setT({ ...t, categories: t.categories.map((x, n) => (n === i ? { ...x, slug: slugify(e.target.value) } : x)) })} className={`${input} w-32 font-mono text-xs`} />
                <span className="w-8 text-right text-xs text-muted">{counts[`c:${c.slug}`] ?? 0}</span>
                <button disabled={i === 0} onClick={() => setT({ ...t, categories: move(t.categories, i, -1) })} className={btn}>↑</button>
                <button disabled={i === t.categories.length - 1} onClick={() => setT({ ...t, categories: move(t.categories, i, 1) })} className={btn}>↓</button>
                <button onClick={() => (counts[`c:${c.slug}`] && !window.confirm(`${counts[`c:${c.slug}`]} products use this category. Remove it anyway?`)) || setT({ ...t, categories: t.categories.filter((_, n) => n !== i) })} className={`${btn} text-sale`}>✕</button>
                <button onClick={() => setOpenCat(openCat === i ? null : i)} className="rounded border border-line px-2 py-1 text-xs">{openCat === i ? "Close" : "More"}</button>
                </div>
                {openCat === i && (
                  <div className="mt-2 grid gap-3 rounded-lg bg-[#fafafa] p-3">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.menu !== false} onChange={(e) => upCat(i, { menu: e.target.checked })} /> Show in the main menu and footer</label>
                    <label className="text-sm"><span className="mb-1 block font-medium">Concerns in its menu drop-down</span>
                      <select value={c.concernGroup ?? "auto"} onChange={(e) => upCat(i, { concernGroup: e.target.value === "auto" ? undefined : (e.target.value as Category["concernGroup"]) })} className={`${input} w-full`}>
                        <option value="auto">Automatic</option><option value="skin">Skin concerns</option><option value="hair">Hair concerns</option><option value="wellness">Wellness concerns</option><option value="">None</option>
                      </select>
                    </label>
                    <MediaField label="Tile picture (homepage category tiles)" value={c.image ?? ""} onChange={(image) => upCat(i, { image: image || undefined })} />
                    <label className="text-sm"><span className="mb-1 block font-medium">Intro text on the category page</span>
                      <textarea rows={2} value={c.description ?? ""} onChange={(e) => upCat(i, { description: e.target.value || undefined })} className={`${input} w-full`} />
                    </label>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <AddRow onAdd={(name) => setT({ ...t, categories: [...t.categories, { name, slug: slugify(name) }] })} />
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">Concerns (shop by concern)</h2>
          <ul className="space-y-2">
            {t.concerns.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <input value={c.name} onChange={(e) => setT({ ...t, concerns: t.concerns.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)) })} className={`${input} flex-1`} />
                <select value={c.group} onChange={(e) => setT({ ...t, concerns: t.concerns.map((x, n) => (n === i ? { ...x, group: e.target.value as Concern["group"] } : x)) })} className={input}>
                  <option value="skin">Skin</option><option value="hair">Hair</option><option value="wellness">Wellness</option>
                </select>
                <span className="w-8 text-right text-xs text-muted">{counts[`k:${c.slug}`] ?? 0}</span>
                <div className="w-72"><MediaField label="" hint="Picture 800×600 (texture or skin close-up)" value={c.image ?? ""} onChange={(image) => setT({ ...t, concerns: t.concerns.map((x, n) => (n === i ? { ...x, image } : x)) })} /></div>
                <button disabled={i === 0} onClick={() => setT({ ...t, concerns: move(t.concerns, i, -1) })} className={btn}>↑</button>
                <button disabled={i === t.concerns.length - 1} onClick={() => setT({ ...t, concerns: move(t.concerns, i, 1) })} className={btn}>↓</button>
                <button onClick={() => setT({ ...t, concerns: t.concerns.filter((_, n) => n !== i) })} className={`${btn} text-sale`}>✕</button>
              </li>
            ))}
          </ul>
          <AddRow onAdd={(name) => setT({ ...t, concerns: [...t.concerns, { name, slug: slugify(name), group: "skin" }] })} />
        </section>
      </div>
    </div>
  );
}

function AddRow({ onAdd }: { onAdd: (name: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(""); } }} className="mt-3 flex gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add new…" className="flex-1 rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-brand-500" />
      <button className="rounded-lg border border-line px-3 text-sm hover:bg-brand-50">Add</button>
    </form>
  );
}
