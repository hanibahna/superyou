"use client";

import { Fragment } from "react";

import { ShareButton } from "@/components/ShareButton";
import { SectionBanner, type SectionBannerData } from "@/components/SectionBanner";
import { useT } from "@/lib/site-context";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ProductCard } from "@/components/ProductCard";
import { VideoStrip } from "@/components/Video";
import { tagLabels, type Category, type Tag } from "@/lib/data/catalog";
import type { ShopQuery, ShopResult } from "@/lib/listing";
import type { VideoItem } from "@/lib/site";
import { ShareMenu } from "@/components/ShareMenu";

const sorts = {
  featured: "Featured",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  discount: "Biggest discount",
  new: "New arrivals",
} as const;

export function ShopView({ result, query, videos = [], category, base = "/shop/", heading, intro, banner, section }: { section?: SectionBannerData | null; result: ShopResult; query: ShopQuery; videos?: VideoItem[]; category?: Category; base?: string; heading?: string; intro?: string; banner?: string }) {
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
  // Phone filter sheet: taps change a draft at once (instant feedback); results refresh quietly
  // in the background a moment after the last tap, instead of reloading the page on every tap.
  const [draft, setDraft] = useState(sp.toString());
  const draftRef = useRef(draft);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { if (!timer.current) { draftRef.current = sp.toString(); setDraft(sp.toString()); } }, [sp]);
  const dq = useMemo(() => new URLSearchParams(draft), [draft]);
  const setD = (key: string, value: string | null, multi = false) => {
    const next = new URLSearchParams(draftRef.current);
    next.delete("page");
    if (multi && value) {
      const all = next.getAll(key);
      next.delete(key);
      (all.includes(value) ? all.filter((v) => v !== value) : [...all, value]).forEach((v) => next.append(key, v));
    } else if (value === null) next.delete(key);
    else next.set(key, value);
    draftRef.current = next.toString();
    setDraft(draftRef.current);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = undefined; go(new URLSearchParams(draftRef.current)); }, 380);
  };
  const clearD = () => {
    const keep = new URLSearchParams();
    for (const k of ["q", "tag", "collection", "sort"]) for (const v of new URLSearchParams(draftRef.current).getAll(k)) keep.append(k, v);
    draftRef.current = keep.toString(); setDraft(draftRef.current);
    clearTimeout(timer.current); timer.current = undefined; go(keep);
  };
  useEffect(() => {
    if (!filtersOpen) return;
    const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setFiltersOpen(false); };
    addEventListener("keydown", esc);
    return () => { document.body.style.overflow = o; removeEventListener("keydown", esc); };
  }, [filtersOpen]);
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
  const whoLabel = query.for === "men" ? tx("Men") : query.for === "women" ? tx("Women") : "";
  const fullTitle = whoLabel && !query.q && !heading ? (title === "All products" ? whoLabel : `${title} · ${whoLabel}`) : title;

  const brandList = useMemo(() => {
    const t = brandFilter.trim().toLowerCase();
    const list = t ? facets.brands.filter((b) => b.name.toLowerCase().includes(t)) : facets.brands;
    const chosen = facets.brands.filter((b) => brand.includes(b.name));
    return [...chosen, ...list.filter((b) => !brand.includes(b.name)).slice(0, t ? 60 : 25)];
  }, [brandFilter, facets.brands, brand]);

  const activeCount = concern.length + brand.length + (query.instock ? 1 : 0) + (query.category ? 1 : 0) + (query.sale ? 1 : 0) + (query.bf ? 1 : 0) + (query.origin ? 1 : 0) + (query.for ? 1 : 0) + (query.min !== undefined || query.max !== undefined ? 1 : 0);

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
      {facets.who && <FilterGroup title="For">
        <Check label={tx("Women")} count={facets.who.women} checked={query.for === "women"} onChange={() => set("for", query.for === "women" ? null : "women")} />
        <Check label={tx("Men")} count={facets.who.men} checked={query.for === "men"} onChange={() => set("for", query.for === "men" ? null : "men")} />
      </FilterGroup>}
      {facets.origins && facets.origins.international > 0 && <FilterGroup title="Ships from">
        <Check label={tx("Lebanon (1–3 days)")} count={facets.origins.local} checked={query.origin === "local"} onChange={() => set("origin", query.origin === "local" ? null : "local")} />
        <Check label={tx("Imported (10–14 days)")} count={facets.origins.international} checked={query.origin === "international"} onChange={() => set("origin", query.origin === "international" ? null : "international")} />
      </FilterGroup>}
      {(f.availability || f.onSale) && <FilterGroup title="Availability & offers">
        {f.availability && <Check label="In stock only" checked={!!query.instock} onChange={() => set("instock", query.instock ? null : "1")} />}
        {f.onSale && <Check label={tx("On sale")} checked={!!query.sale} onChange={() => set("sale", query.sale ? null : "1")} />}
        {f.onSale && <Check label={tx("Black Friday")} checked={!!query.bf} onChange={() => set("bf", query.bf ? null : "1")} />}
      </FilterGroup>}
    </div>
  );

  return (
    <div className="container-x py-5 md:py-8">
      <nav className="mb-2 text-xs text-muted">
        <Link href="/" className="hover:underline">Home</Link> / <span>{fullTitle}</span>
      </nav>
      {/* Phones: the section banner waits until after the first 6 products, so products show on the first screen. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold md:text-3xl">{fullTitle}<ShareMenu align="start" size={34} text={`🛍️ ${fullTitle} · SuperYou (${total.toLocaleString("en-US")} products)\n${typeof window !== "undefined" ? window.location.href.split("#")[0] : ""}`} /></h1>
          {(intro || (category?.description && !query.q)) && <p className="mt-1 max-w-2xl whitespace-pre-line text-sm text-muted">{intro || category?.description}</p>}
          <p className="mt-1 text-sm text-muted">{total.toLocaleString("en-US")} products{pending ? " · updating…" : ""}</p>
        </div>
        <div className="filter-bar sticky top-14 z-20 md:top-[72px] flex items-center gap-2 bg-white/90 py-2 backdrop-blur-xl lg:static lg:bg-transparent lg:p-0">
          <button onClick={() => setFiltersOpen(true)} className="tap flex flex-1 items-center justify-center gap-2 rounded-full border border-line px-4 text-sm font-semibold lg:hidden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
            {tx("Filters")}{activeCount ? <span className="rounded-full bg-ink px-1.5 text-xs text-white">{activeCount}</span> : null}
          </button>
          <select aria-label={tx("Sort by")} value={query.sort ?? ""} onChange={(e) => set("sort", e.target.value)} className="tap flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm outline-none lg:flex-none lg:rounded-lg">
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
          {query.for && <Chip label={query.for === "men" ? tx("Men") : tx("Women")} onClear={() => set("for", null)} />}
          {query.origin && <Chip label={query.origin === "international" ? "Imported" : "Ships from Lebanon"} onClear={() => set("origin", null)} />}
          {query.sale && <Chip label={tx("On sale")} onClear={() => set("sale", null)} />}
          {query.bf && <Chip label={tx("Black Friday")} onClear={() => set("bf", null)} />}
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
        <aside className="shop-filters hidden lg:block">{Filters}</aside>
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
              {items.map((p, i) => (
                <Fragment key={p.slug}>
                  <ProductCard product={p} />
                  {i === Math.min(5, items.length - 1) && section && page === 1 && <div className="col-span-2 md:hidden"><SectionBanner s={section} /></div>}
                  {/* Desktop: help and tips after the first two rows, so products start on the first screen. */}
                  {i === Math.min(7, items.length - 1) && section && page === 1 && <div className="col-span-full hidden md:block"><SectionBanner s={section} /></div>}
                </Fragment>
              ))}
            </div>
          )}
          {pages > 1 && <Pager page={page} pages={pages} href={pageHref} />}
        </div>
      </div>

      {filtersOpen && (() => {
        const dConcern = dq.getAll("concern"), dBrand = dq.getAll("brand");
        const dCount = dConcern.length + dBrand.length + ["instock", "category", "sale", "bf", "origin", "for"].filter((k) => dq.get(k)).length + (dq.get("min") || dq.get("max") ? 1 : 0);
        return (
          <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label={tx("Filters")}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setFiltersOpen(false)} />
            <div className="sheet-up absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[28px] bg-white shadow-2xl">
              <div className="shrink-0 border-b border-line px-5 pb-3 pt-2">
                <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line" aria-hidden />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-bold">{tx("Filters")}{dCount ? <span className="ms-2 rounded-full bg-ink px-2 py-0.5 text-xs text-white">{dCount}</span> : null}</p>
                  <div className="flex items-center gap-1">
                    {dCount > 0 && <button onClick={clearD} className="tap px-3 text-sm font-semibold text-brand-700">{tx("Clear all")}</button>}
                    <button onClick={() => setFiltersOpen(false)} aria-label={tx("Close")} className="grid h-11 w-11 place-items-center rounded-full bg-[#f2f0f1]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-2 [-webkit-overflow-scrolling:touch]">
                {f.category && facets.categories.length > 0 && (
                  <SheetGroup title={tx("Category")} n={dq.get("category") ? 1 : 0} open>
                    {facets.categories.map((c) => <Pill key={c.slug} label={c.name} count={c.count} on={dq.get("category") === c.slug} onClick={() => setD("category", dq.get("category") === c.slug ? null : c.slug)} />)}
                  </SheetGroup>
                )}
                {f.concern && facets.concerns.length > 0 && (
                  <SheetGroup title={tx("Concern")} n={dConcern.length} open>
                    {facets.concerns.map((c) => <Pill key={c.slug} label={c.name} count={c.count} on={dConcern.includes(c.slug)} onClick={() => setD("concern", c.slug, true)} />)}
                  </SheetGroup>
                )}
                {f.brand && facets.brands.length > 0 && (
                  <SheetGroup title={tx("Brand")} n={dBrand.length} list>
                    {facets.brands.length > 12 && (
                      <input value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} placeholder={tx("Find a brand…")} className="mb-1 h-11 w-full rounded-xl bg-[#f2f0f1] px-3.5 text-[15px] outline-none focus:ring-2 focus:ring-ink/20" />
                    )}
                    {[...facets.brands.filter((b) => dBrand.includes(b.name)), ...brandList.filter((b) => !dBrand.includes(b.name))].slice(0, brandFilter ? 60 : 30).map((b) => (
                      <Row key={b.name} label={b.name} count={b.count} on={dBrand.includes(b.name)} onClick={() => setD("brand", b.name, true)} />
                    ))}
                  </SheetGroup>
                )}
                {f.price && priceRange[1] > 0 && (
                  <SheetGroup title={tx("Price") + " ($)"} n={dq.get("min") || dq.get("max") ? 1 : 0}>
                    <form onSubmit={(e) => { e.preventDefault(); setD("min", min || null); setD("max", max || null); }} className="flex w-full items-center gap-2">
                      <input value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d.]/g, ""))} placeholder={`${tx("Min")} ${priceRange[0]}`} inputMode="decimal" aria-label="Minimum price" className="h-11 min-w-0 flex-1 rounded-xl bg-[#f2f0f1] px-3 text-[15px] outline-none" />
                      <span className="text-muted">–</span>
                      <input value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d.]/g, ""))} placeholder={`${tx("Max")} ${priceRange[1]}`} inputMode="decimal" aria-label="Maximum price" className="h-11 min-w-0 flex-1 rounded-xl bg-[#f2f0f1] px-3 text-[15px] outline-none" />
                      <button className="h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-white">{tx("Apply")}</button>
                    </form>
                  </SheetGroup>
                )}
                {facets.who && (
                  <SheetGroup title={tx("For")} n={dq.get("for") ? 1 : 0}>
                    <Pill label={tx("Women")} count={facets.who.women} on={dq.get("for") === "women"} onClick={() => setD("for", dq.get("for") === "women" ? null : "women")} />
                    <Pill label={tx("Men")} count={facets.who.men} on={dq.get("for") === "men"} onClick={() => setD("for", dq.get("for") === "men" ? null : "men")} />
                  </SheetGroup>
                )}
                {(f.availability || f.onSale) && (
                  <SheetGroup title={tx("Availability & offers")} n={["instock", "sale", "bf"].filter((k) => dq.get(k)).length} open>
                    {f.availability && <Pill label={tx("In stock")} on={!!dq.get("instock")} onClick={() => setD("instock", dq.get("instock") ? null : "1")} />}
                    {f.onSale && <Pill label={tx("On sale")} on={!!dq.get("sale")} onClick={() => setD("sale", dq.get("sale") ? null : "1")} />}
                    {f.onSale && <Pill label={tx("Black Friday")} on={!!dq.get("bf")} onClick={() => setD("bf", dq.get("bf") ? null : "1")} />}
                  </SheetGroup>
                )}
              </div>
              <div className="shrink-0 border-t border-line bg-white px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
                <button onClick={() => setFiltersOpen(false)} className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[16px] font-semibold text-white">
                  {pending || timer.current ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden /> : null}
                  {tx("Show")} {total.toLocaleString("en-US")} {tx("products")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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
          <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={`min-w-11 rounded-lg px-3 py-2.5 text-center ${n === page ? "bg-brand-500 font-semibold text-white" : "border border-line hover:bg-brand-50"}`}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link href={href(page + 1)} className="rounded-lg border border-line px-3 py-1.5 hover:bg-brand-50">{tx("Next")}</Link>}
    </nav>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="ftitle mb-2 text-xs font-bold uppercase tracking-wider text-muted">{title}</p>
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

/** Phone filter sheet: a collapsible group with how many are chosen. */
function SheetGroup({ title, n, open = false, list = false, children }: { title: string; n: number; open?: boolean; list?: boolean; children: React.ReactNode }) {
  return (
    <details open={open || n > 0} className="group border-b border-line py-1 last:border-0">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold">
        <span>{title}{n > 0 && <span className="ms-2 text-xs font-bold text-brand-700">{n}</span>}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="text-muted transition group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
      </summary>
      <div className={list ? "pb-3" : "flex flex-wrap gap-2 pb-4"}>{children}</div>
    </details>
  );
}

function Pill({ label, count, on, onClick }: { label: string; count?: number; on: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`min-h-[40px] rounded-full border px-3.5 text-sm font-medium transition active:scale-95 ${on ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
      {label}{count !== undefined && <span className={`ms-1.5 text-xs ${on ? "text-white/70" : "text-muted"}`}>{count.toLocaleString("en-US")}</span>}
    </button>
  );
}

function Row({ label, count, on, onClick }: { label: string; count?: number; on: boolean; onClick: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onClick} className="flex min-h-[46px] w-full items-center gap-3 text-start text-[15px] active:bg-[#f7f5f6]">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${on ? "border-ink bg-ink text-white" : "border-line"}`}>
        {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" aria-hidden><path d="M5 12l5 5 9-10" /></svg>}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-xs text-muted">{count.toLocaleString("en-US")}</span>}
    </button>
  );
}
