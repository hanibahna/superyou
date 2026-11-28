"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MenuItem } from "@/lib/site";
import { useT } from "@/lib/site-context";

const tMenu = (items: MenuItem[], t: (s: string) => string): MenuItem[] => items.map((i) => ({ ...i, label: t(i.label), children: i.children ? tMenu(i.children, t) : i.children }));

const isLink = (h: string) => !!h && h !== "#";

/** Desktop navigation from Admin → Navigation: top items, mega panel with columns, 3 levels deep. */
export function MegaMenu({ items: raw, extra }: { items: MenuItem[]; extra?: React.ReactNode }) {
  const t = useT();
  const items = tMenu(raw, t);
  const [open, setOpen] = useState<number | null>(null);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open === null || !nav.current) return;
    const set = () => document.documentElement.style.setProperty("--mega-top", `${Math.max(0, nav.current!.getBoundingClientRect().bottom)}px`);
    set();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    addEventListener("scroll", set, { passive: true });
    addEventListener("keydown", esc);
    return () => { removeEventListener("scroll", set); removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <nav ref={nav} className="mega hidden border-t border-line lg:block" onMouseLeave={() => setOpen(null)}>
      <ul className="container-x no-scrollbar flex h-11 items-center gap-5 whitespace-nowrap text-sm font-semibold xl:gap-7">
        {items.map((it, i) => (
          <li key={i} className="h-full" onMouseEnter={() => setOpen(it.children.length ? i : null)}>
            {isLink(it.href) ? (
              <Link href={it.href} onClick={() => setOpen(null)} className={`flex h-full items-center border-b-2 ${open === i ? "border-ink" : "border-transparent"} ${it.highlight ? "text-sale" : "hover:text-brand-600"}`}>{it.label}</Link>
            ) : (
              <span className={`flex h-full cursor-default items-center border-b-2 ${open === i ? "border-ink" : "border-transparent"}`}>{it.label}</span>
            )}
          </li>
        ))}
        {extra}
      </ul>
      {open !== null && items[open]?.children.length > 0 && (
        <>
          {/* The page stays where it is: the panel lies over it and the page behind is dimmed (click it to close). */}
          <div aria-hidden onMouseEnter={() => setOpen(null)} onClick={() => setOpen(null)} className="mega-scrim fixed inset-x-0 bottom-0 z-30 bg-black/35 backdrop-blur-[2px]" style={{ top: "var(--mega-top, 0px)" }} />
          <Panel item={items[open]} close={() => setOpen(null)} />
        </>
      )}
    </nav>
  );
}

function Panel({ item, close }: { item: MenuItem; close: () => void }) {
  const tx = useT();
  // Second-level items without children are grouped into a first "Shop" block; the rest flow in columns.
  const singles = item.children.filter((c) => !c.children.length);
  const groups = item.children.filter((c) => c.children.length);
  const many = groups.length > 6;
  return (
    <div className="absolute left-0 right-0 top-full z-40 max-h-[78vh] overflow-y-auto border-t border-line bg-white text-ink shadow-xl">
      <div className={`container-x flex gap-8 py-7`}>
        <div className={`flex-1 gap-8 ${many ? "columns-3 xl:columns-5" : "columns-2 lg:columns-3 xl:columns-4"}`}>
          {singles.length > 0 && (
            <div className="mb-6 break-inside-avoid">
              <p className="mb-2.5 text-xs font-bold uppercase tracking-wider">{item.label}</p>
              <ul className="space-y-1.5 text-sm">
                {isLink(item.href) && <li><Link href={item.href} onClick={close} className="font-semibold hover:underline">Shop all {item.label}</Link></li>}
                {singles.map((c, i) => (
                  <li key={i}>{isLink(c.href) ? <Link href={c.href} onClick={close} className={`hover:underline ${c.highlight ? "font-semibold text-sale" : ""}`}>{c.label}</Link> : <span className="text-muted">{c.label}</span>}</li>
                ))}
              </ul>
            </div>
          )}
          {groups.map((g, i) => (
            <div key={i} className="mb-6 break-inside-avoid">
              {isLink(g.href) ? (
                <Link href={g.href} onClick={close} className="mb-2.5 block text-xs font-bold uppercase tracking-wider hover:underline">{g.label}</Link>
              ) : (
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wider">{g.label}</p>
              )}
              <ul className="space-y-1.5 text-sm">
                {g.children.slice(0, many ? 8 : 14).map((c, k) => (
                  <li key={k}>{isLink(c.href) ? <Link href={c.href} onClick={close} className="text-muted hover:text-ink hover:underline">{c.label}</Link> : <span className="text-muted">{c.label}</span>}</li>
                ))}
                {g.children.length > (many ? 8 : 14) && isLink(g.href) && <li><Link href={g.href} onClick={close} className="text-xs font-semibold underline">{tx("View all")}</Link></li>}
              </ul>
            </div>
          ))}
        </div>
        {item.image && (
          <Link href={isLink(item.href) ? item.href : "#"} onClick={close} className="hidden w-64 shrink-0 overflow-hidden rounded-lg xl:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image} alt="" className="h-full max-h-96 w-full object-cover" />
          </Link>
        )}
      </div>
    </div>
  );
}

// Thin line icons for top-level categories (matched on the English label).
const ICONS: [RegExp, string][] = [
  [/offer|deal|sale|black friday/i, "M7 17 17 7M8 8h.01M16 16h.01M9 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm8 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"],
  [/make ?up|cosmetic/i, "M10 21h4V11h-4v10Zm0-10 1-6h2l1 6M9 3h6"],
  [/skin/i, "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"],
  [/fragrance|perfume|parfum/i, "M9 7h6v3H9zM8 10h8v10H8zM11 4h2v3h-2z"],
  [/hair/i, "M7 21c0-6 1-9 5-14 4 5 5 8 5 14M12 7c-1 4-1 9 0 14"],
  [/body|bath/i, "M5 11h14v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6Zm2-4h10v4H7z"],
  [/baby|mom|kids|mother/i, "M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9c1-4 3-6 6-6s5 2 6 6"],
  [/men\b|homme/i, "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 10c1-5 4-7 7-7s6 2 7 7"],
  [/pharma|health|supplement|vitamin/i, "M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"],
  [/brand/i, "M3 12V4h8l10 10-8 8L3 12Zm5-4h.01"],
  [/tool|brush|nail/i, "M14 4l6 6-9 9H5v-6l9-9Z"],
  [/sun|spf/i, "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-4v2m0 14v2M3 12h2m14 0h2"],
];
const iconFor = (label: string) => ICONS.find(([r]) => r.test(label))?.[1];

/** Mobile drawer: one level at a time, sliding panels with a back button (Sephora style). */
export function MobileMenu({ items: raw, onNavigate, footer, onBrands }: { items: MenuItem[]; onNavigate: () => void; footer?: React.ReactNode; onBrands?: () => void }) {
  const tx = useT();
  const items = tMenu(raw, tx);
  const [path, setPath] = useState<number[]>([]);
  const level = path.reduce<MenuItem[]>((list, i) => list[i]?.children ?? [], items);
  const parent = path.length ? path.reduce<MenuItem | null>((p, i, n) => (n === 0 ? items[i] : p?.children[i] ?? null), null) : null;
  return (
    <div className="relative">
      <div key={path.join("-")} className={path.length ? "menu-in" : ""}>
        {parent && (
          <>
            <button onClick={() => setPath(path.slice(0, -1))} className="tap -mx-1 mb-1 flex w-full items-center gap-2 px-1 text-sm font-semibold text-muted">
              <span className="rtl-flip text-lg leading-none">‹</span> {tx("Back")}
            </button>
            <p className="mb-1 text-xl font-bold">{parent.label}</p>
            {onBrands && /^\/brands\/?$/.test(parent.href ?? "") ? (
              // The brands section: list every brand right here instead of leaving the menu.
              <button onClick={onBrands} className="tap mb-2 flex w-full items-center justify-between border-b border-line text-sm font-semibold">{tx("All brands A–Z")} <span className="rtl-flip text-xl leading-none text-muted">›</span></button>
            ) : (
              isLink(parent.href) && <Link href={parent.href} onClick={onNavigate} className="tap mb-2 flex items-center border-b border-line text-sm font-semibold underline">{tx("View all")}</Link>
            )}
          </>
        )}
        <ul className="divide-y divide-line">
          {level.map((it, i) => (
            <li key={i}>
              {!it.children.length && onBrands && /^\/brands\/?$/.test(it.href ?? "") ? (
                <button onClick={onBrands} className={`flex min-h-[52px] w-full items-center justify-between gap-3 text-start ${path.length ? "text-[15px]" : "text-base font-semibold"}`}>
                  <span>{it.label}</span><span className="rtl-flip text-xl leading-none text-muted">›</span>
                </button>
              ) : it.children.length ? (
                <button onClick={() => setPath([...path, i])} className={`flex min-h-[52px] w-full items-center justify-between gap-3 text-start ${path.length ? "text-[15px]" : "text-base font-semibold"} ${it.highlight ? "text-sale" : ""}`}>
                  <span className="flex items-center gap-3">
                    {!path.length && !it.image && iconFor(raw[i]?.label ?? "") && (
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-muted"><path d={iconFor(raw[i]?.label ?? "")} /></svg>
                    )}
                    {it.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image} alt="" className="h-9 w-9 rounded-full bg-[#f5f5f5] object-cover" />
                    )}
                    {it.label}
                  </span>
                  <span className="rtl-flip text-xl leading-none text-muted">›</span>
                </button>
              ) : (
                <Link href={isLink(it.href) ? it.href : "/shop/"} onClick={onNavigate} className={`flex min-h-[52px] items-center gap-3 ${path.length ? "text-[15px]" : "text-base font-semibold"} ${it.highlight ? "text-sale" : ""}`}>
                  {!path.length && iconFor(raw[i]?.label ?? "") && <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-muted"><path d={iconFor(raw[i]?.label ?? "")} /></svg>}
                  {it.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
        {!path.length && footer}
      </div>
    </div>
  );
}
