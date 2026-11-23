"use client";

import { cleanName } from "@/lib/data/catalog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";
import { imgUrl } from "@/lib/img";
import { useSite, useT } from "@/lib/site-context";
import { SearchIcon } from "./Icons";

type Suggest = {
  products: { slug: string; name: string; brand: string; price: number; image?: string }[];
  brands: string[];
  categories: { slug: string; name: string }[];
  concerns: { slug: string; name: string }[];
  redirect?: string;
};

/** Search field with suggestions while typing (Admin → Search → "Suggestions while typing"). */
export function SearchBox({ onDone, className = "", autoFocus = false }: { onDone?: () => void; className?: string; autoFocus?: boolean }) {
  const tx = useT();
  const { search, lang } = useSite();
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { try { setRecent(JSON.parse(localStorage.getItem("sy:searches") ?? "[]")); } catch { /* ignore */ } }, []);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggest | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!search.predictive || q.trim().length < 2) return setData(null);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search/suggest/?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then(setData)
        .catch(() => {});
    }, 180);
    return () => (clearTimeout(t), ctl.abort());
  }, [q, search.predictive]);

  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    onDone?.();
    router.push(href);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    try { localStorage.setItem("sy:searches", JSON.stringify([term, ...recent.filter((r) => r !== term)].slice(0, 6))); } catch { /* ignore */ }
    go(data?.redirect ?? `/shop/?q=${encodeURIComponent(term)}`);
  };

  const empty = data && !data.products.length && !data.brands.length && !data.categories.length && !data.concerns.length;

  return (
    <div ref={box} className={`relative ${className}`}>
      <form onSubmit={submit} role="search">
        <label className="flex items-center gap-2 rounded-full border border-line bg-[#f7f8f7] px-4 py-2 focus-within:border-brand-500">
          <SearchIcon width={18} height={18} className="text-muted" />
          <input
            value={q}
            onChange={(e) => (setQ(e.target.value), setOpen(true))}
            onFocus={() => setOpen(true)}
            autoFocus={autoFocus}
            placeholder={lang === "ar" ? "ابحث عن منتج، ماركة أو مشكلة…" : tx("Search products, brands or concerns…")}
            aria-label={tx("Search")}
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </form>
      {open && (q.trim().length < 2 ? search.popular.length + recent.length > 0 : !!data) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-white p-3 text-sm text-ink shadow-xl">
          {q.trim().length < 2 ? (
            <>
              {recent.length > 0 && (
                <div className="mb-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Recent searches</p>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((p) => <button key={p} onClick={() => go(`/shop/?q=${encodeURIComponent(p)}`)} className="rounded-full bg-[#f2f2f2] px-3 py-1">{p}</button>)}
                  </div>
                </div>
              )}
              {search.popular.length > 0 && <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{tx("Popular searches")}</p>}
              <div className="flex flex-wrap gap-2">
                {search.popular.map((p) => (
                  <button key={p} onClick={() => go(`/shop/?q=${encodeURIComponent(p)}`)} className="rounded-full border border-line px-3 py-1 hover:border-brand-500">{p}</button>
                ))}
              </div>
            </>
          ) : empty ? (
            <p className="p-2 text-muted">{tx("No matches yet. Press Enter to search everything.")}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-[1fr_200px]">
              <div>
                {data!.products.length > 0 && <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">{tx("Products")}</p>}
                <ul>
                  {data!.products.map((p) => (
                    <li key={p.slug}>
                      <Link href={`/products/${p.slug}/`} onClick={() => (setOpen(false), onDone?.())} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-brand-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.image ? <img src={imgUrl(p.image, 96)} alt="" className="h-10 w-10 rounded object-contain" /> : <span className="h-10 w-10 rounded bg-brand-50" />}
                        <span className="flex-1 leading-tight"><span className="block text-xs text-muted">{p.brand}</span>{cleanName(p.name)}</span>
                        <span className="font-semibold">{money(p.price)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <button onClick={submit} className="mt-2 w-full rounded-lg bg-brand-50 py-2 font-semibold text-brand-700">See all results for “{q.trim()}”</button>
              </div>
              <div className="space-y-3">
                {[
                  ["Brands", data!.brands.map((b) => ({ label: b, href: `/shop/?brand=${encodeURIComponent(b)}` }))],
                  ["Categories", data!.categories.map((c) => ({ label: c.name, href: `/shop/?category=${c.slug}` }))],
                  ["Concerns", data!.concerns.map((c) => ({ label: c.name, href: `/shop/?concern=${c.slug}` }))],
                ].map(([title, items]) =>
                  (items as { label: string; href: string }[]).length ? (
                    <div key={title as string}>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">{title as string}</p>
                      {(items as { label: string; href: string }[]).map((i) => (
                        <button key={i.href} onClick={() => go(i.href)} className="block w-full rounded px-1.5 py-1 text-left hover:bg-brand-50">{i.label}</button>
                      ))}
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
