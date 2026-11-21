"use client";

import { useState } from "react";
import type { Collection, Collections } from "@/lib/site";
import { Area, Card, Header, ListInput, MediaField, Text, Toggle, useSaver } from "./fields";

export function CollectionsEditor({ initial, counts }: { initial: Collections; counts: Record<string, number> }) {
  const [c, setC] = useState<Collections>(initial);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const saver = useSaver("/api/admin/collections/");
  const up = (key: string, patch: Partial<Collection>) => (saver.touch(), setC({ items: c.items.map((x) => (x.key === key ? { ...x, ...patch } : x)) }));
  const shown = c.items.filter((x) => !q || `${x.title} ${x.key}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <Header title="Collections" sub="Curated product groups at /collections/… — used by menus, banners and links" saver={saver} onSave={() => saver.save(c)} />
      <Card
        title={`${c.items.length.toLocaleString("en-US")} collections`}
        sub="Products join a collection when imported into it, when they match its brands, or when they match its search words."
        actions={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a collection…" className="w-56 rounded-lg border border-line px-3 py-1.5 text-sm" />}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const key = newKey.trim().toLowerCase().replace(/[^a-z0-9/_-]+/g, "-");
            if (!key || c.items.some((x) => x.key === key)) return;
            saver.touch();
            setC({ items: [{ key, title: newKey.trim(), description: "", image: "", rule: "", brands: [], hidden: false }, ...c.items] });
            setOpen(key);
            setNewKey("");
          }}
          className="mb-4 flex gap-2"
        >
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="New collection name, e.g. Summer essentials" className="flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
          <button className="rounded-lg bg-ink px-4 text-sm text-white">+ Create</button>
        </form>
        <ul className="divide-y divide-line">
          {shown.slice(0, 300).map((x) => (
            <li key={x.key}>
              <div className="flex items-center gap-3 py-2 text-sm">
                <button onClick={() => setOpen(open === x.key ? null : x.key)} className="min-w-0 flex-1 text-left">
                  <b>{x.title}</b> <span className="font-mono text-xs text-muted">/collections/{x.key}/</span>
                </button>
                <span className="w-24 text-right text-xs text-muted">{(counts[x.key.toLowerCase()] ?? 0).toLocaleString("en-US")} tagged{x.rule || x.brands.length ? " + rules" : ""}</span>
                <a href={`/collections/${x.key}/`} target="_blank" className="text-brand-600">View ↗</a>
              </div>
              {open === x.key && (
                <div className="mb-3 grid gap-3 rounded-lg bg-[#fafafa] p-4 md:grid-cols-2">
                  <Text label="Title" value={x.title} onChange={(title) => up(x.key, { title })} />
                  <Toggle label="Hidden (page returns 404)" checked={x.hidden} onChange={(hidden) => up(x.key, { hidden })} />
                  <Area label="Intro text" value={x.description} onChange={(description) => up(x.key, { description })} />
                  <MediaField label="Banner picture" value={x.image} onChange={(image) => up(x.key, { image })} />
                  <ListInput label="Also include all products of these brands" value={x.brands} onChange={(brands) => up(x.key, { brands })} />
                  <Text label="Also include products matching these search words" value={x.rule} onChange={(rule) => up(x.key, { rule })} placeholder="e.g. vitamin c serum" />
                  <button onClick={() => window.confirm("Delete this collection?") && (saver.touch(), setC({ items: c.items.filter((y) => y.key !== x.key) }))} className="w-fit text-sm text-sale">Delete collection</button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {shown.length > 300 && <p className="mt-2 text-xs text-muted">Showing 300 of {shown.length} — use the search box.</p>}
      </Card>
    </div>
  );
}
