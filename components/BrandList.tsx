"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/site-context";

type Brand = { name: string; count: number };
let cache: Brand[] | null = null;
const letter = (n: string) => { const c = n.normalize("NFKD")[0]?.toUpperCase() ?? "#"; return /[A-Z]/.test(c) ? c : "#"; };

/** Every brand on sale, A–Z, inside the mobile menu: tap a brand to open its products. */
export function BrandList({ onBack, onNavigate }: { onBack: () => void; onNavigate: () => void }) {
  const tx = useT();
  const [brands, setBrands] = useState<Brand[] | null>(cache);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (cache) return;
    fetch("/api/brands/").then((r) => r.json()).then((d: { brands: Brand[] }) => setBrands((cache = d.brands))).catch(() => setBrands([]));
  }, []);
  const groups = useMemo(() => {
    const s = q.trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
    const m = new Map<string, Brand[]>();
    for (const b of brands ?? []) {
      if (s && !b.name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").includes(s)) continue;
      (m.get(letter(b.name)) ?? m.set(letter(b.name), []).get(letter(b.name))!).push(b);
    }
    return [...m.entries()];
  }, [brands, q]);
  const jump = (l: string) => document.getElementById(`mb-${l}`)?.scrollIntoView({ block: "start" });
  return (
    <div className="menu-in">
      <button onClick={onBack} className="tap -mx-1 mb-1 flex w-full items-center gap-2 px-1 text-sm font-semibold text-muted">
        <span className="rtl-flip text-lg leading-none">‹</span> {tx("Back")}
      </button>
      <p className="mb-2 text-xl font-bold">{tx("Brands A–Z")}</p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Find a brand")} className="mb-2 h-11 w-full rounded-full border border-line px-4 text-[15px] outline-none focus:border-ink" />
      {!q && groups.length > 0 && (
        <div className="sticky top-0 z-10 -mx-1 mb-2 flex flex-wrap gap-0.5 bg-white py-1 text-xs font-semibold">
          {groups.map(([l]) => <button key={l} onClick={() => jump(l)} className="grid h-7 w-7 place-items-center rounded hover:bg-brand-50">{l}</button>)}
        </div>
      )}
      {brands === null ? (
        <p className="py-6 text-center text-sm text-muted">{tx("Loading…")}</p>
      ) : groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{tx("No brand found")}</p>
      ) : (
        groups.map(([l, list]) => (
          <div key={l} id={`mb-${l}`} className="scroll-mt-10">
            <p className="mt-3 border-b border-line pb-1 text-sm font-bold text-muted">{l}</p>
            <ul className="divide-y divide-line">
              {list.map((b) => (
                <li key={b.name}>
                  <Link href={`/shop/?brand=${encodeURIComponent(b.name)}`} onClick={onNavigate} className="flex min-h-[48px] items-center justify-between gap-3 text-[15px]">
                    <span>{b.name}</span><span className="text-xs text-muted">{b.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <Link href="/brands/" onClick={onNavigate} className="tap mt-4 flex items-center justify-center rounded-full border border-line text-sm font-semibold">{tx("Open the brands page")}</Link>
    </div>
  );
}
