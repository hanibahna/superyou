"use client";

import { useT } from "@/lib/site-context";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ProductCard } from "@/components/ProductCard";
import { VideoStrip } from "@/components/Video";
import { tagLabels, type Category, type Tag } from "@/lib/data/catalog";
import type { ShopQuery, ShopResult } from "@/lib/listing";
import type { VideoItem } from "@/lib/site";

const sorts = {
  featured: "Featured",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  discount: "Biggest discount",
  new: "New arrivals",
} as const;

export function ShopView({ result, query, videos = [], category, base = "/shop/", heading, intro, banner }: { result: ShopResult; query: ShopQuery; videos?: VideoItem[]; category?: Category; base?: string; heading?: string; intro?: string; banner?: string }) {
  const tx = useT();
  const sp = useSearchParams();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [brandFilter, setBrandFilter] = useState("");
  const { items, total, page, pages, facets, taxonomy, search, priceRange } = result;
  const f = search.filters;
  const [min, setMin] = useState(query.min !== undefined ? String(query.min) : "");
  const [max, setMax] = useState(query.max !== undefined ? String(query.max) : "");
  const applyPrice = () => {
    const next = new URLSearchParams(sp.toString());
    next.delete("page");
    min ? next.set("min", min) : next.delete(tx("min"));
    max ? next.set("max", max) : next.delete("max");
    go(next);
  };

  const go = (next: URLSearchParams) => start(() => router.push(`${base}?${next.toString()}`, { scroll: false }));
  const set = (key: string, value: string | null, multi = false) => {
    const next = new URLSearchParams(sp.toString());
    next.delete("page");
    if (multi && value) {
      const all = next.getAll(key);
      next.delete(key);
      (all.includes(value) ? all.filter((v) => v !== value) : [...all, value]).forEach((v) => next.append(key, v));
    } else if (value === null) next.delete(key);
    else next.set(key, value);
    go(next);
  };
  const pageHref = (n: number) => {
    const next = new URLSearchParams(sp.toString());
    n <= 1 ? next.delete("page") : next.set("page", String(n));
    return `${base}?${next.toString()}`;
  };

  const concern = query.concern ?? [];
  const brand = query.brand ?? [];
  const catName = (slug?: string) => taxonomy.categories.find((c) => c.slug === slug)?.name;
  const title = heading ? heading : query.q
    ? `Results for “${query.q}”`
    : query.category
      ? catName(query.category)
      : query.tag
        ? tagLabels[query.tag as Tag] ?? tx("Products")
        : concern.length === 1
          ? taxonomy.concerns.find((c) => c.slug === concern[0])?.name
          : brand.length === 1
            ? brand[0]
            : "All products";

  const brandList = useMemo(() => {
    const t = brandFilter.trim().toLowerCase();
    const list = t ? facets.brands.filter((b) => b.name.toLowerCase().includes(t)) : facets.brands;
    const chosen = facets.brands.filter((b) => brand.includes(b.name));
    return [...chosen, ...list.filter((b) => !brand.includes(b.name)).slice(0, t ? 60 : 25)];
  }, [brandFilter, facets.brands, brand]);

  const activeCount = concern.length + brand.length + (query.instock ? 1 : 0) + (query.category ? 1 : 0) + (query.sale ? 1 : 0) + (query.min !== undefined || query.max !== undefined ? 1 : 0);

  const Filters = (
    <div className="space-y-7 text-sm">
      {f.category && <FilterGroup title={tx("Category")}>
        {facets.categories.map((c) => (
          <Check key={c.slug} label={c.name} count={c.count} checked={query.category === c.slug} onChange={() => set("category", query.category === c.slug ? null : c.slug)} />
        ))}
      </FilterGroup>}
      {f.concern && facets.concerns.length > 0 && (
        <FilterGroup title={tx("Concern")}>
          {facets.concerns.map((c) => (
            <Check key={c.slug} label={c.name} count={c.count} checked={concern.includes(c.slug)} onChange={() => set("concern", c.slug, true)} />
          ))}
        </FilterGroup>
      )}
      {f.brand && <FilterGroup title={`Brand (${facets.brands.length})`}>
        {facets.brands.length > 12 && (
          <input value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} placeholder={tx("Find a brand…")} className="mb-2 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand-500" />
        )}
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {brandList.map((b) => (
            <Check key={b.name} label={b.name} count={b.count} checked={brand.includes(b.name)} onChange={() => set("brand", b.name, true)} />
          ))}
        </div>
      </FilterGroup>}
      {f.price && priceRange[1] > 0 && (
        <FilterGroup title="Price ($)">
          <form onSubmit={(e) => (e.preventDefault(), applyPrice())} className="flex items-center gap-2">
            <input value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d.]/g, ""))} placeholder={String(priceRange[0])} inputMode="decimal" aria-label="Minimum price" className="w-full rounded-lg border border-line px-2 py-1.5 outline-none focus:border-brand-500" />
            <span className="text-muted">–</span>
            <input value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d.]/g, ""))} placeholder={String(priceRange[1])} inputMode="decimal" aria-label="Maximum price" className="w-full rounded-lg border border-line px-2 py-1.5 outline-none focus:border-brand-500" />
            <button className="rounded-lg border border-line px-2.5 py-1.5 hover:bg-brand-50">{tx("Go")}</button>
          </form>
        </FilterGroup>
      )}
      {(f.availability || f.onSale) && <FilterGroup title="Availability & offers">
        {f.availability && <Check label="In stock only" checked={!!query.instock} onChange={() => set("instock", query.instock ? null : "1")} />}
        {f.onSale && <Check label={tx("On sale")} checked={!!query.sale} onChange={() => set("sale", query.sale ? null : "1")} />}
      </FilterGroup>}
    </div>
  );

  return (
    <div className="container-x py-8">
      <nav className="mb-2 text-xs text-muted">
        <Link href="/" className="hover:underline">Home</Link> / <span>{title}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          {(intro || (category?.description && !query.q)) && <p className="mt-1 max-w-2xl whitespace-pre-line text-sm text-muted">{intro || category?.description}</p>}
          <p className="mt-1 text-sm text-muted">{total.toLocaleString("en-US")} products{pending ? " · updating…" : ""}</p>
        </div>
        <div className="sticky top-16 z-20 -mx-4 flex w-[calc(100%+2rem)] items-center gap-2 bg-white/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:w-auto lg:bg-transparent lg:p-0">
          <button onClick={() => setFiltersOpen(true)} className="tap flex-1 rounded-lg border border-line px-4 py-2 text-sm font-semibold lg:hidden">
            Filters{activeCount ? ` (${activeCount})` : ""}
          </button>
          <select value={query.sort ?? ""} onChange={(e) => set("sort", e.target.value)} className="tap flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none lg:flex-none">
            {!query.sort && <option value="">{tx("Sort by")}</option>}
            {Object.entries(sorts).map(([k, v]) => <option key={k} value={k}>{query.q && k === "featured" ? tx("Best match") : tx(v)}</option>)}
          </select>
        </div>
      </div>

      {activeCount > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {query.category && <Chip label={catName(query.category) ?? query.category} onClear={() => set("category", null)} />}
          {concern.map((c) => <Chip key={c} label={taxonomy.concerns.find((k) => k.slug === c)?.name ?? c} onClear={() => set("concern", c, true)} />)}
          {brand.map((b) => <Chip key={b} label={b} onClear={() => set("brand", b, true)} />)}
          {query.instock && <Chip label="In stock" onClear={() => set("instock", null)} />}
          {query.sale && <Chip label={tx("On sale")} onClear={() => set("sale", null)} />}
          {(query.min !== undefined || query.max !== undefined) && <Chip label={`$${query.min ?? 0}–${query.max ?? "∞"}`} onClear={() => { const n = new URLSearchParams(sp.toString()); n.delete(tx("min")); n.delete("max"); go(n); }} />}
          <button onClick={() => router.push(query.q ? `${base}?q=${encodeURIComponent(query.q)}` : base)} className="text-xs font-semibold text-brand-600 hover:underline">Clear all</button>
        </div>
      )}

      {banner && page === 1 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={banner} alt="" className="mb-4 mt-4 max-h-72 w-full rounded-xl object-cover" />
      )}
      {videos.length > 0 && page === 1 && <VideoStrip videos={videos} title="Watch: tips & tutorials" />}

      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">{Filters}</aside>
        <div className={pending ? "opacity-60 transition" : ""}>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-12 text-center">
              <p className="font-semibold">No products match.</p>
              <p className="mt-1 text-sm text-muted">{tx("Try another spelling, remove a filter, or browse our best sellers.")}</p>
              {search.popular.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
                  {search.popular.map((p) => <Link key={p} href={`/shop/?q=${encodeURIComponent(p)}`} className="rounded-full border border-line px-3 py-1 hover:border-brand-500">{p}</Link>)}
                </div>
              )}
              <Link href="/shop/?tag=favorite" className="mt-4 inline-block rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white">{tx("See best sellers")}</Link>
            </div>
          ) : (
            <div className="pgrid grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {items.map((p) => <ProductCard key={p.slug} product={p} />)}
            </div>
          )}
          {pages > 1 && <Pager page={page} pages={pages} href={pageHref} />}
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFiltersOpen(false)} />
          <div className="sheet-up absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-6">
            {Filters}
            <button onClick={() => setFiltersOpen(false)} className="mt-6 w-full rounded-lg bg-brand-500 py-3 font-semibold text-white">Show {total.toLocaleString("en-US")} products</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Pager({ page, pages, href }: { page: number; pages: number; href: (n: number) => string }) {
  const tx = useT();
  const nums = Array.from(new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages])).filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1 text-sm" aria-label={tx("Pages")}>
      {page > 1 && <Link href={href(page - 1)} className="rounded-lg border border-line px-3 py-1.5 hover:bg-brand-50">{tx("Previous")}</Link>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={`min-w-9 rounded-lg px-3 py-1.5 text-center ${n === page ? "bg-brand-500 font-semibold text-white" : "border border-line hover:bg-brand-50"}`}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link href={href(page + 1)} className="rounded-lg border border-line px-3 py-1.5 hover:bg-brand-50">{tx("Next")}</Link>}
    </nav>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Check({ label, checked, onChange, count }: { label: string; checked: boolean; onChange: () => void; count?: number }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 hover:text-brand-600">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 shrink-0 accent-[var(--color-brand-500)]" />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-xs text-muted">{count.toLocaleString("en-US")}</span>}
    </label>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button onClick={onClear} className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100">
      {label} ✕
    </button>
  );
}
