"use client";

import { useState } from "react";
import type { Taxonomy } from "@/lib/data/catalog";
import type { MenuItem, Settings } from "@/lib/site";
import { Card, Header, MediaField, move, useSaver } from "./fields";

const blank = (): MenuItem => ({ label: "New link", href: "/shop/", children: [] });

export function NavigationEditor({ initial, taxonomy }: { initial: Settings; taxonomy: Taxonomy }) {
  const [s, setS] = useState<Settings>(initial);
  const saver = useSaver("/api/admin/settings/");
  const setMenu = (menu: MenuItem[]) => (saver.touch(), setS({ ...s, menu }));
  const setFooter = (footerMenu: Settings["footerMenu"]) => (saver.touch(), setS({ ...s, footerMenu }));

  const fromCategories = () =>
    setMenu([
      ...taxonomy.categories.filter((c) => c.menu !== false).map((c) => ({
        label: c.name, href: `/shop/?category=${c.slug}`,
        children: [
          { label: "Shop all", href: `/shop/?category=${c.slug}`, children: [] },
          { label: "Best sellers", href: `/shop/?category=${c.slug}&tag=favorite`, children: [] },
          { label: "New arrivals", href: `/shop/?category=${c.slug}&tag=new`, children: [] },
        ],
      })),
      { label: "Brands", href: "/brands/", children: [] },
      { label: "Offers", href: "/shop/?sale=1", children: [], highlight: true },
    ]);

  return (
    <div>
      <Header
        title="Navigation"
        sub="Main menu (with drop-down mega menus, 3 levels) and footer links"
        saver={saver}
        onSave={() => saver.save(s)}
        extra={<a href="/" target="_blank" className="text-sm text-brand-600 hover:underline">Preview ↗</a>}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Card
          title="Main menu"
          sub={<>Top level = the menu bar. Level 2 = columns in the drop-down (items without sub-links are listed in a “Shop” column). Level 3 = links in each column. Link to <code>/collections/…</code>, <code>/shop/?brand=…</code>, <code>/shop/?category=…</code>, <code>/brands/</code>, <code>/pages/…</code> or any address. Use <code>#</code> for a heading that isn't a link.</>}
          actions={
            <div className="flex gap-2">
              <button onClick={() => window.confirm("Replace the menu with one built from your categories?") && fromCategories()} className="rounded-lg border border-line px-3 py-1.5 text-sm">Build from categories</button>
              <button onClick={() => setMenu([...s.menu, blank()])} className="rounded-lg bg-ink px-3 py-1.5 text-sm text-white">+ Top item</button>
            </div>
          }
        >
          {s.menu.length === 0 && <p className="text-sm text-muted">The menu is built automatically from your categories. Add items or click “Build from categories” to customise it.</p>}
          <Tree items={s.menu} onChange={setMenu} depth={0} />
        </Card>

        <Card title="Footer columns" sub="Up to 2 link columns next to your store details. Leave empty for the automatic Shop / Help columns." actions={s.footerMenu.length < 2 && <button onClick={() => setFooter([...s.footerMenu, { title: "Help", links: [] }])} className="rounded-lg border border-line px-3 py-1.5 text-sm">+ Column</button>}>
          {s.footerMenu.map((col, i) => (
            <div key={i} className="mb-4 rounded-lg border border-line p-3">
              <div className="mb-2 flex gap-2">
                <input value={col.title} onChange={(e) => setFooter(s.footerMenu.map((c, n) => (n === i ? { ...c, title: e.target.value } : c)))} className="flex-1 rounded border border-line px-2 py-1 text-sm font-semibold" />
                <button onClick={() => setFooter(s.footerMenu.filter((_, n) => n !== i))} className="text-sm text-sale">Remove</button>
              </div>
              {col.links.map((l, k) => (
                <div key={k} className="mb-1 flex gap-1">
                  <input value={l.label} onChange={(e) => setFooter(s.footerMenu.map((c, n) => (n === i ? { ...c, links: c.links.map((x, m) => (m === k ? { ...x, label: e.target.value } : x)) } : c)))} className="w-1/2 rounded border border-line px-2 py-1 text-xs" />
                  <input value={l.href} onChange={(e) => setFooter(s.footerMenu.map((c, n) => (n === i ? { ...c, links: c.links.map((x, m) => (m === k ? { ...x, href: e.target.value } : x)) } : c)))} className="w-1/2 rounded border border-line px-2 py-1 font-mono text-xs" />
                  <button onClick={() => setFooter(s.footerMenu.map((c, n) => (n === i ? { ...c, links: c.links.filter((_, m) => m !== k) } : c)))} className="px-1 text-sale">✕</button>
                </div>
              ))}
              <button onClick={() => setFooter(s.footerMenu.map((c, n) => (n === i ? { ...c, links: [...c.links, { label: "Link", href: "/" }] } : c)))} className="mt-1 text-xs text-brand-600">+ Link</button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function Tree({ items, onChange, depth }: { items: MenuItem[]; onChange: (v: MenuItem[]) => void; depth: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const up = (i: number, patch: Partial<MenuItem>) => onChange(items.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  return (
    <ul className={depth ? "ml-5 mt-1 space-y-1 border-l border-line pl-3" : "space-y-1.5"}>
      {items.map((it, i) => (
        <li key={i}>
          <div className={`flex items-center gap-1.5 rounded-lg ${depth === 0 ? "bg-[#f4f4f4] p-2" : "p-1"}`}>
            {depth < 2 && (
              <button onClick={() => setOpen(open === i ? null : i)} className="w-5 text-muted" title={open === i ? "Collapse" : "Expand"}>{it.children.length || open === i ? (open === i ? "▾" : "▸") : "·"}</button>
            )}
            <input value={it.label} onChange={(e) => up(i, { label: e.target.value })} className={`min-w-0 flex-1 rounded border border-line bg-white px-2 py-1 text-sm ${depth === 0 ? "font-semibold" : ""}`} />
            <input value={it.href} onChange={(e) => up(i, { href: e.target.value })} className="min-w-0 flex-[1.3] rounded border border-line bg-white px-2 py-1 font-mono text-xs" />
            {depth < 2 && <span className="w-8 text-center text-xs text-muted">{it.children.length || ""}</span>}
            <label className="flex items-center gap-1 text-xs text-muted" title="Show in sale colour"><input type="checkbox" checked={!!it.highlight} onChange={(e) => up(i, { highlight: e.target.checked || undefined })} />red</label>
            <button disabled={i === 0} onClick={() => onChange(move(items, i, -1))} className="px-1 disabled:opacity-30">↑</button>
            <button disabled={i === items.length - 1} onClick={() => onChange(move(items, i, 1))} className="px-1 disabled:opacity-30">↓</button>
            <button onClick={() => (!it.children.length || window.confirm(`Remove “${it.label}” and its ${it.children.length} sub-links?`)) && onChange(items.filter((_, n) => n !== i))} className="px-1 text-sale">✕</button>
          </div>
          {open === i && depth < 2 && (
            <div>
              {depth === 0 && (
                <div className="ml-5 mt-2 max-w-md"><MediaField label="Picture in the drop-down (optional)" value={it.image ?? ""} onChange={(image) => up(i, { image: image || undefined })} /></div>
              )}
              <Tree items={it.children} onChange={(children) => up(i, { children })} depth={depth + 1} />
              <button onClick={() => up(i, { children: [...it.children, blank()] })} className="ml-8 mt-1 text-xs font-semibold text-brand-600">+ Add {depth === 0 ? "column / link" : "link"}</button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
