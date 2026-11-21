"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import type { Category, ProductLite } from "@/lib/data/catalog";
import { money } from "@/lib/format";

type Query = { q: string; filter: string; cat: string; brand: string };

export function ProductsTable({ rows, matching, total, page, pages, categories, query }: { rows: ProductLite[]; matching: number; total: number; page: number; pages: number; categories: Category[]; query: Query }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(query.q);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const nav = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) (v === null || v === "" ? next.delete(k) : next.set(k, v));
    if (!("page" in patch)) next.delete("page");
    router.push(`/admin/products/?${next.toString()}`);
  };

  // Search as you type (debounced).
  useEffect(() => {
    if (q === query.q) return;
    const t = setTimeout(() => nav({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const allShownSelected = rows.length > 0 && rows.every((p) => selected.has(p.id));
  const bulk = async (action: "activate" | "draft" | "delete") => {
    if (action === "delete" && !window.confirm(`Delete ${selected.size} product(s)? This can't be undone.`)) return;
    setBusy(true);
    await fetch("/api/admin/products/", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ids: [...selected] }) });
    setSelected(new Set());
    setBusy(false);
    router.refresh();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Products <span className="text-base font-normal text-muted">({total.toLocaleString("en-US")})</span></h1>
        <div className="flex gap-2">
          <Link href="/admin/import/" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-brand-50">Import / export</Link>
          <Link href="/admin/products/new/" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Add product</Link>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, brand, SKU, barcode…" className="min-w-60 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />
        <select value={query.cat} onChange={(e) => nav({ cat: e.target.value })} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        <div className="flex flex-wrap rounded-lg border border-line bg-white p-0.5 text-sm">
          {[["all", "All"], ["active", "Live"], ["draft", "Drafts"], ["soldout", "Sold out"], ["noimage", "No photo"]].map(([k, l]) => (
            <button key={k} onClick={() => nav({ filter: k === "all" ? null : k })} className={`rounded-md px-3 py-1.5 ${query.filter === k ? "bg-brand-500 text-white" : "text-muted"}`}>{l}</button>
          ))}
        </div>
      </div>
      {query.brand && (
        <p className="mt-2 text-sm">Brand: <b>{query.brand}</b> <button onClick={() => nav({ brand: null })} className="text-brand-600 underline">clear</button></p>
      )}

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm text-white">
          <span className="mr-2">{selected.size} selected</span>
          <button disabled={busy} onClick={() => bulk("activate")} className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">Make live</button>
          <button disabled={busy} onClick={() => bulk("draft")} className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">Make draft</button>
          <button disabled={busy} onClick={() => bulk("delete")} className="rounded bg-sale px-3 py-1">Delete</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-white/70 hover:text-white">Clear</button>
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted">
            <tr>
              <th className="w-10 p-3">
                <input type="checkbox" checked={allShownSelected} onChange={() => {
                  const next = new Set(selected);
                  rows.forEach((p) => (allShownSelected ? next.delete(p.id) : next.add(p.id)));
                  setSelected(next);
                }} />
              </th>
              <th className="p-3">Product</th>
              <th className="p-3">SKU</th>
              <th className="p-3">Category</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3 text-right">Stock</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-[#fafbfa]">
                <td className="p-3">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => {
                    const next = new Set(selected);
                    next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                    setSelected(next);
                  }} />
                </td>
                <td className="p-3">
                  <Link href={`/admin/products/${p.id}/`} className="flex items-center gap-3">
                    <ProductImage product={p} width={120} className="h-10 w-10 shrink-0 rounded-md" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium hover:text-brand-600">{p.name}</span>
                      <span className="block truncate text-xs text-muted">{p.brand}{p.variant ? ` · ${p.variant}` : ""}</span>
                    </span>
                  </Link>
                </td>
                <td className="p-3 font-mono text-xs">{p.sku}</td>
                <td className="p-3">{categories.find((c) => c.slug === p.category)?.name ?? p.category}</td>
                <td className="whitespace-nowrap p-3 text-right">
                  {money(p.price)}
                  {p.compareAt && <span className="block text-xs text-muted line-through">{money(p.compareAt)}</span>}
                </td>
                <td className={`p-3 text-right ${!p.inStock ? "font-semibold text-sale" : p.stock !== undefined && p.stock <= 5 ? "font-semibold text-amber-600" : ""}`}>
                  {p.stock ?? (p.inStock ? "In stock" : "Sold out")}
                </td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status === "active" ? "bg-brand-50 text-brand-700" : "bg-line text-muted"}`}>{p.status === "active" ? "Live" : "Draft"}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-muted">No products found.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted">{matching.toLocaleString("en-US")} matching · page {page} of {pages}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => nav({ page: String(page - 1) })} className="rounded-lg border border-line bg-white px-3 py-1.5 disabled:opacity-40">Previous</button>
          <button disabled={page >= pages} onClick={() => nav({ page: String(page + 1) })} className="rounded-lg border border-line bg-white px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
