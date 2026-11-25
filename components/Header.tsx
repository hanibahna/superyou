"use client";

import { ScanIcon } from "./ScanIcon";
import { createPortal } from "react-dom";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Category, Taxonomy } from "@/lib/data/catalog";
import { useGrowth, useSettings, useSite, useT } from "@/lib/site-context";
import { useShop } from "@/lib/store";
import { BagIcon, CloseIcon, HeartIcon, MenuIcon, UserIcon } from "./Icons";
import { LangSwitch } from "./Growth";
import { MegaMenu, MobileMenu } from "./MegaMenu";
import { SearchBox } from "./SearchBox";
import { BrandList } from "./BrandList";

export function AnnouncementBar() {
  const tx = useT();
  const { announcement: a, store, social } = useSettings();
  const { club } = useGrowth();
  if (!a.enabled || !a.text) return null;
  return (
    <div className="announce bg-brand-600 text-white">
      <div className="container-x flex h-9 items-center justify-between text-xs">
        {a.showContacts && store.phone ? (
          <span className="hidden gap-4 sm:flex">
            <a href={`tel:${store.phone.replace(/\s/g, "")}`} className="opacity-90 hover:opacity-100">{store.phone}</a>
            {store.whatsapp && <a href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noreferrer" className="font-semibold opacity-90 hover:opacity-100">{tx("WhatsApp chat")}</a>}
          </span>
        ) : <span className="hidden sm:block" />}
        {a.link ? (
          <Link href={a.link} className="mx-auto truncate font-medium underline-offset-2 hover:underline sm:mx-0">{a.text}</Link>
        ) : (
          <p className="mx-auto truncate font-medium sm:mx-0">{a.text}</p>
        )}
        <div className="hidden gap-3 opacity-90 sm:flex">
          {club.enabled && <Link href="/club/" className="font-semibold">{club.name}</Link>}
          {a.showContacts && (["instagram", "facebook", "tiktok", "youtube"] as const).filter((k) => social[k]).map((k) => (
            <a key={k} href={social[k]} target="_blank" rel="noreferrer" className="capitalize">{k === "tiktok" ? "TikTok" : k === "youtube" ? "YouTube" : k}</a>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Header({ taxonomy: { categories: all, concerns } }: { taxonomy: Taxonomy }) {
  const growthFlags = useGrowth();
  const tx = useT();
  const { count, wishlist, setDrawerOpen } = useShop();
  const { settings, routineEnabled, growth } = useSite();
  const scanOn = !!growth?.skinScan?.enabled;
  const t = useT();
  const store = settings.store;
  const [menuOpen, setMenuOpenRaw] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const setMenuOpen = (v: boolean) => (setMenuOpenRaw(v), v || setBrandsOpen(false));
  const path = usePathname();
  const categories = all.filter((c) => c.menu !== false);
  const groupFor = (slug: string, g?: Category["concernGroup"]) =>
    g !== undefined ? g : slug === "hair" ? "hair" : slug === "supplements" ? "wellness" : slug === "skincare" ? "skin" : "";

  return (
    <header className="site-header sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="hdr-row container-x flex h-16 items-center gap-4 md:h-[72px] lg:h-16">
        <button className="-ms-2.5 grid h-11 w-11 place-items-center lg:hidden" onClick={() => setMenuOpen(true)} aria-label={tx("Open menu")}>
          <MenuIcon />
        </button>
        <Link href="/" aria-label={`${store.name} home`} className="hdr-logo flex shrink-0 items-center gap-2 md:gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/superyou-mark.svg" alt="" aria-hidden className="h-7 w-7 rounded-md ring-1 ring-white/25 md:h-9 md:w-9" />
          <span className="grid justify-items-stretch gap-[3px] xl:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/superyou-logo.svg" alt={store.name} className="logo-on-light h-5 w-auto md:h-7" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/superyou-logo-white.svg" alt="" aria-hidden className="logo-on-dark h-5 w-auto md:h-7" />
            {/* Phones & tablets: our address right under the name */}
            {/* Letters spread to exactly the width of the wordmark, on every screen size */}
            <SiteUrl className="site-id-sm flex w-full justify-between text-[9px] font-extrabold leading-none md:text-[11px] xl:hidden">
              {"SHOPSUPERYOU.COM".split("").map((ch, i) => <span key={i} aria-hidden className={i < 4 || i > 11 ? "sy-accent" : undefined}>{ch}</span>)}
            </SiteUrl>
            {/* Tablets: the promise sits under the address, lined up with the logo (doesn't widen it) */}
            {store.tagline && <span className="site-id-sm hidden w-0 min-w-full whitespace-nowrap text-[11px] leading-none text-muted md:block lg:hidden">{store.tagline}</span>}
          </span>
        </Link>
        {/* Our web address (so people remember it) and our promise, next to the logo. */}
        <div className="site-id -ms-1 hidden w-[250px] shrink-0 flex-col justify-center border-s border-line ps-3 leading-tight xl:flex 2xl:w-[300px]">
          <SiteUrl className="self-start text-[13px] font-extrabold tracking-[0.08em]"><span className="sy-accent">SHOP</span>SUPERYOU<span className="sy-accent">.COM</span></SiteUrl>
          {store.tagline && <span className="mt-0.5 text-[11px] leading-snug text-muted [text-wrap:balance]">{store.tagline}</span>}
        </div>

        <SearchBox className="hdr-search mx-auto hidden max-w-xl flex-1 lg:block" />

        <nav className="-me-2.5 ms-auto flex items-center gap-1 lg:ms-0 lg:gap-2">
          <LangSwitch className="hidden px-2 text-sm hover:text-brand-600 sm:block" />
          <Link href="/account/" aria-label={tx("Account")} className="hidden grid h-11 w-11 place-items-center hover:text-brand-600 sm:grid">
            <UserIcon />
          </Link>
          <Link href="/wishlist/" aria-label={tx("Wishlist")} className="relative grid h-11 w-11 place-items-center hover:text-brand-600">
            <HeartIcon />
            {wishlist.length > 0 && <Badge n={wishlist.length} />}
          </Link>
          <button onClick={() => setDrawerOpen(true)} aria-label={tx("Cart")} className="hdr-bag relative grid h-11 w-11 place-items-center hover:text-brand-600">
            <BagIcon data-bag />
            {count > 0 && <Badge n={count} />}
          </button>
        </nav>
      </div>
      {/* Phones & tablets: our promise as a slim line under the logo row */}
      {store.tagline && <p className="site-id-sm container-x -mt-1.5 pb-1.5 text-center text-[10px] leading-snug tracking-[-0.01em] text-muted [text-wrap:balance] min-[400px]:text-[10.5px] md:hidden lg:block lg:text-start lg:text-xs xl:hidden">{store.tagline}</p>}
      {/* Phones: on the home page, search sits in plain view under the logo. */}
      {path === "/" && <div className="container-x pb-3 lg:hidden"><SearchBox /></div>}

      {/* Desktop category nav with mega menu */}
      {settings.menu.length > 0 ? (
        <MegaMenu items={settings.menu} extra={<>{scanOn && <li className="ml-auto h-full"><Link href="/skin-scan/" className="flex h-full items-center"><span className="scan-glow inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold text-white"><ScanIcon size={16} />{t("SuperScan")}</span></Link></li>}{routineEnabled ? <li className={`${scanOn ? "ms-4" : "ml-auto"} h-full`}><Link href="/routine/" className="glow-link flex h-full items-center gap-1.5 font-semibold text-brand-600">✨ {t("Routine finder")}<span className="new-pill">NEW</span></Link></li> : null}</>} />
      ) : (
      <nav className="hidden border-t border-line lg:block">
          <ul className="container-x no-scrollbar flex h-11 items-center gap-5 whitespace-nowrap text-sm font-medium xl:gap-7">
            {categories.map((c) => { const grp = groupFor(c.slug, c.concernGroup); return (
              <li key={c.slug} className="group relative h-full">
                <Link href={`/shop/?category=${c.slug}`} className="flex h-full items-center hover:text-brand-600">
                  {c.name}
                </Link>
                {grp && concerns.some((k) => k.group === grp) && (
                  <div className="invisible absolute left-0 top-full z-50 w-64 rounded-b-xl border border-line bg-white p-4 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{tx("Shop by concern")}</p>
                    <ul className="space-y-1.5">
                      {concerns
                        .filter((k) => k.group === grp)
                        .map((k) => (
                          <li key={k.slug}>
                            <Link href={`/shop/?category=${c.slug}&concern=${k.slug}`} className="hover:text-brand-600">
                              {k.name}
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </li>
            ); })}
            {routineEnabled && (
              <li className="ml-auto">
                <Link href="/routine/" className="font-semibold text-brand-600">{tx("Routine finder")}</Link>
              </li>
            )}
            <li className={routineEnabled ? "" : "ml-auto"}>
              <Link href="/shop/?sort=discount" className="font-semibold text-sale">
                {tx("Offers")}
              </Link>
            </li>
          </ul>
        </nav>
      )}

      {/* Mobile drawer: full screen, sliding panels, big tap targets */}
      {menuOpen && createPortal(
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label={tx("Menu")}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="drawer-in absolute inset-y-0 start-0 flex w-full max-w-md flex-col bg-white">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/superyou-mark.svg" alt="" aria-hidden className="h-7 w-7 rounded-md" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/superyou-logo.svg" alt={store.name} className="h-5 w-auto" />
              </span>
              <div className="flex items-center gap-2">
                <LangSwitch />
                <button onClick={() => setMenuOpen(false)} aria-label={tx("Close menu")} className="tap grid w-11 place-items-center"><CloseIcon /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3">
              <SearchBox className="mb-4" onDone={() => setMenuOpen(false)} />
              <div className="mb-4 grid grid-cols-2 gap-2">
                {routineEnabled && (
                  <Link href="/routine/" onClick={() => setMenuOpen(false)} className="glow-pill relative rounded-2xl bg-ink p-3 text-white">
                    <span className="new-pill absolute end-2 top-2">NEW</span>
                    <span className="block text-lg">✨</span><span className="text-sm font-semibold">{tx("Routine finder")}</span>
                  </Link>
                )}
                {growth.skinScan.enabled && (
                  <Link href="/skin-scan/" onClick={() => setMenuOpen(false)} className="relative rounded-2xl bg-brand-50 p-3">
                    <span className="new-pill absolute end-2 top-2">AI</span>
                    <span className="block text-lg">📸</span><span className="text-sm font-semibold">{tx("SuperScan")}</span>
                  </Link>
                )}
                <Link href="/shop/?sale=1" onClick={() => setMenuOpen(false)} className="rounded-2xl bg-[#fbeef2] p-3"><span className="block text-lg">%</span><span className="text-sm font-semibold text-sale">{tx("Offers")}</span></Link>
                <Link href="/shop/?sort=new" onClick={() => setMenuOpen(false)} className="rounded-2xl bg-[#f5f5f5] p-3"><span className="block text-lg">★</span><span className="text-sm font-semibold">{tx("New arrivals")}</span></Link>
              </div>
              {brandsOpen ? (
                <BrandList onBack={() => setBrandsOpen(false)} onNavigate={() => setMenuOpen(false)} />
              ) : settings.menu.length > 0 ? (
                <MobileMenu
                  onBrands={() => setBrandsOpen(true)}
                  items={settings.menu}
                  onNavigate={() => setMenuOpen(false)}
                  footer={
                    <div className="mt-4 space-y-1 border-t border-line pt-3 text-[15px]">
                      {[[growthFlags.eventsOn === false ? "Services" : "Services & Events", "/services/"], ["Wholesale", "/wholesale/"], ["SuperYou Club", "/club/"], ["My account", "/account/"], ["Wishlist", "/wishlist/"]].map(([l, h]) => (
                        <Link key={h} href={h} onClick={() => setMenuOpen(false)} className="flex min-h-[48px] items-center">{tx(l)}{h === "/wishlist/" && wishlist.length > 0 ? ` (${wishlist.length})` : ""}</Link>
                      ))}
                      <a href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noreferrer" className="mt-2 flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#25D366] font-semibold text-white">{tx("WhatsApp us")}</a>
                      <a href={`tel:${store.phone.replace(/\s/g, "")}`} className="flex min-h-[48px] items-center justify-center rounded-full border border-line font-semibold" dir="ltr">{store.phone}</a>
                    </div>
                  }
                />
              ) : (
                <ul className="divide-y divide-line">
                  {categories.map((c) => (
                    <li key={c.slug}><Link onClick={() => setMenuOpen(false)} href={`/shop/?category=${c.slug}`} className="flex min-h-[52px] items-center font-semibold">{c.name}</Link></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      , document.body)}
    </header>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute right-0.5 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
      {n}
    </span>
  );
}

/** Our web address: tap to copy it (a small "Copied" bubble confirms), with a quick WhatsApp share. */
function SiteUrl({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  const url = "https://shopsuperyou.com";
  const copy = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try { await navigator.clipboard.writeText(url); } catch {}
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  };
  return (
    <span className="relative">
      <span role="button" tabIndex={0} dir="ltr" title={t("Copy our web address")} aria-label={`shopsuperyou.com, ${t("tap to copy")}`} onClick={copy} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && copy(e)} className={`cursor-copy underline-offset-2 hover:underline ${className}`}>
        {children}
      </span>
      {done && (
        <span role="status" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="sp-in absolute start-0 top-full z-50 mt-1.5 flex items-center gap-2 whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold normal-case tracking-normal text-white shadow-lg">
          ✓ {t("Link copied")}
          <span role="button" tabIndex={0} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`SuperYou: original beauty & pharmacy, paid on delivery. ${url}`)}`, "_blank", "noopener")} className="cursor-pointer rounded-full bg-[#25d366] px-2 py-0.5 text-white">WhatsApp</span>
        </span>
      )}
    </span>
  );
}
