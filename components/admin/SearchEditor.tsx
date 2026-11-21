"use client";

import { useState } from "react";
import type { SearchSettings } from "@/lib/site";
import { Card, Header, ListInput, Num, ProductPicker, Select, Text, Toggle, useSaver } from "./fields";

export function SearchEditor({ initial }: { initial: SearchSettings }) {
  const [s, setS] = useState<SearchSettings>(initial);
  const saver = useSaver("/api/admin/search-settings/");
  const up = (patch: Partial<SearchSettings>) => (saver.touch(), setS({ ...s, ...patch }));
  const [test, setTest] = useState("");

  return (
    <div>
      <Header
        title="Search & filters"
        sub="Make search find what customers mean, and choose which filters appear on listing pages"
        saver={saver}
        onSave={() => saver.save(s)}
        extra={
          <form onSubmit={(e) => { e.preventDefault(); if (test) window.open(`/shop/?q=${encodeURIComponent(test)}`, "_blank"); }} className="hidden md:block">
            <input value={test} onChange={(e) => setTest(e.target.value)} placeholder="Test a search ↗" className="w-40 rounded-lg border border-line px-3 py-1.5 text-sm" />
          </form>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Synonyms" sub="Words that mean the same thing. A search for any word in a group finds products named with the others (e.g. “sunblock” finds SPF creams).">
          <ListInput
            label="One group per line, words separated by commas"
            rows={8}
            value={s.synonyms.map((g) => g.join(", "))}
            onChange={(lines) => up({ synonyms: lines.map((l) => l.split(",").map((w) => w.trim()).filter(Boolean)).filter((g) => g.length >= 2) })}
            placeholder={"sunscreen, sunblock, spf\nmoisturizer, moisturiser"}
          />
        </Card>

        <Card title="How search works">
          <div className="space-y-4">
            <Toggle label="Typo tolerance" hint="“cerav” and “serrum” still find results when exact matches are few" checked={s.typoTolerance} onChange={(typoTolerance) => up({ typoTolerance })} />
            <Toggle label="Suggestions while typing" hint="Drop-down with top products, brands, categories and concerns" checked={s.predictive} onChange={(predictive) => up({ predictive })} />
            <Select label="Sold-out products in search" value={s.outOfStock} onChange={(outOfStock) => up({ outOfStock })} options={[["last", "Show at the end"], ["show", "Show normally"], ["hide", "Hide"]]} />
            <div>
              <p className="mb-2 text-sm font-medium">Search in</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(s.fields) as (keyof SearchSettings["fields"])[]).map((f) => (
                  <Toggle key={f} label={{ name: "Product name", brand: "Brand", category: "Category", concerns: "Concerns", variant: "Size / shade", sku: "SKU", barcode: "Barcode" }[f]} checked={s.fields[f]} onChange={(v) => up({ fields: { ...s.fields, [f]: v } })} />
                ))}
              </div>
            </div>
            <ListInput label="Ignored words (stop words)" hint="Common words skipped in searches" value={s.stopWords} onChange={(stopWords) => up({ stopWords })} />
          </div>
        </Card>

        <Card
          title="Pinned results (product boosts)"
          sub="Put chosen products at the top for specific searches, e.g. pin your best SPF for “sunscreen”."
          actions={<button onClick={() => up({ boosts: [...s.boosts, { terms: [""], slugs: [] }] })} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-brand-50">+ Add</button>}
        >
          {s.boosts.length === 0 && <p className="text-sm text-muted">None yet.</p>}
          <div className="space-y-3">
            {s.boosts.map((b, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-line p-3">
                <div className="flex gap-2">
                  <ListInput className="flex-1" label="Search terms (up to 10, comma separated)" value={b.terms} onChange={(terms) => up({ boosts: s.boosts.map((x, n) => (n === i ? { ...x, terms: terms.slice(0, 10) } : x)) })} />
                  <button onClick={() => up({ boosts: s.boosts.filter((_, n) => n !== i) })} className="self-end pb-2 text-sm text-sale">Remove</button>
                </div>
                <ProductPicker label="Products to pin (in order)" by="slug" max={20} value={b.slugs} onChange={(slugs) => up({ boosts: s.boosts.map((x, n) => (n === i ? { ...x, slugs } : x)) })} />
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card
            title="Search redirects"
            sub="Send an exact search straight to a page, e.g. “offers” → /shop/?sale=1, “cerave” → the CeraVe brand page."
            actions={<button onClick={() => up({ redirects: [...s.redirects, { term: "", url: "/shop/" }] })} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-brand-50">+ Add</button>}
          >
            {s.redirects.length === 0 && <p className="text-sm text-muted">None yet.</p>}
            <div className="space-y-2">
              {s.redirects.map((r, i) => (
                <div key={i} className="flex items-end gap-2">
                  <Text className="flex-1" label="When someone searches" value={r.term} onChange={(term) => up({ redirects: s.redirects.map((x, n) => (n === i ? { ...x, term } : x)) })} />
                  <Text className="flex-1" label="Go to" value={r.url} onChange={(url) => up({ redirects: s.redirects.map((x, n) => (n === i ? { ...x, url } : x)) })} />
                  <button onClick={() => up({ redirects: s.redirects.filter((_, n) => n !== i) })} className="pb-2 text-sale">✕</button>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Hidden from search" sub="These items never appear in search results (they stay in categories).">
            <ProductPicker label="" by="slug" max={2000} value={s.hidden} onChange={(hidden) => up({ hidden })} />
          </Card>
        </div>

        <Card title="Popular searches" sub="Shown when the search box is empty and on “no results” pages">
          <ListInput label="Comma separated" value={s.popular} onChange={(popular) => up({ popular: popular.slice(0, 20) })} />
        </Card>

        <Card title="Filters & listing pages">
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(s.filters) as (keyof SearchSettings["filters"])[]).map((f) => (
              <Toggle key={f} label={{ category: "Category", concern: "Concern", brand: "Brand", price: "Price range", availability: "In stock only", onSale: "On sale" }[f]} checked={s.filters[f]} onChange={(v) => up({ filters: { ...s.filters, [f]: v } })} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Num label="Products per page" min={12} value={s.perPage} onChange={(perPage) => up({ perPage: Math.min(96, Math.max(12, perPage)) })} />
            <Select label="Default sort" value={s.defaultSort} onChange={(defaultSort) => up({ defaultSort })} options={[["featured", "Featured"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"], ["discount", "Biggest discount"], ["new", "New arrivals"]]} />
          </div>
        </Card>
      </div>
    </div>
  );
}
