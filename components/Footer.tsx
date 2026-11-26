"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Category } from "@/lib/data/catalog";
import { useSettings, useT } from "@/lib/site-context";
import { NewsletterForm } from "./NewsletterForm";
import { ChatIcon, GiftIcon, ShieldIcon, TruckIcon } from "./Icons";

export function TrustStrip() {
  const { trust } = useSettings();
  const icons = [<ShieldIcon key="s" />, <TruckIcon key="t" />, <GiftIcon key="g" />, <ChatIcon key="c" />];
  const items = trust.filter((t) => t.title).map((t, n) => ({ ...t, icon: icons[n % icons.length] }));
  if (!items.length) return null;
  return (
    <section className="trust-strip border-y border-line bg-brand-50">
      <div className="container-x grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
        {items.map((i) => (
          <div key={i.title} className="flex items-start gap-3">
            <span className="text-brand-600">{i.icon}</span>
            <div>
              <p className="text-sm font-semibold">{i.title}</p>
              <p className="text-xs text-muted">{i.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Footer({ categories }: { categories: Category[] }) {
  const tx = useT();
  const { store, pages, social, payments, footerMenu } = useSettings();
  const accepted = [payments.cod.enabled && tx("Cash on delivery"), payments.card.enabled && "Visa · Mastercard", payments.whish.enabled && "Whish"].filter(Boolean).join(" · ");
  return (
    <footer className="site-footer bg-ink text-white/80">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/superyou-mark.svg" alt="" aria-hidden className="h-10 w-10 rounded-lg ring-1 ring-white/25" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/superyou-logo-white.svg" alt={store.name} className="h-6 w-auto" />
          </div>
          <p className="mt-3 text-sm">{store.tagline}</p>
          <p className="mt-4 text-sm">{store.address}</p>
          <a href={`tel:${store.phone.replace(/\s/g, "")}`} className="block text-sm hover:underline">{store.phone}</a>
          {store.email && !/example\.com$/i.test(store.email) && <p className="text-sm">{store.email}</p>}
          {store.openingHours && <p className="text-sm">{store.openingHours}</p>}
          {store.whatsapp && <a href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-bold text-white">{tx("WhatsApp chat")}</a>}
          <Link href="/gift-cards/" className="ms-2 mt-3 inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">🎁 {tx("Gift cards")}</Link>
          <div className="mt-4 flex gap-3 text-sm">
            {(["instagram", "facebook", "tiktok", "youtube"] as const).filter((k) => social[k]).map((k) => (
              <a key={k} href={social[k]} target="_blank" rel="noreferrer" className="rounded-full border border-white/20 px-3 py-1 hover:bg-white/10">
                {k === "tiktok" ? "TikTok" : k === "youtube" ? "YouTube" : k[0].toUpperCase() + k.slice(1)}
              </a>
            ))}
          </div>
        </div>
        {footerMenu.length > 0 ? (
          footerMenu.slice(0, 2).map((col) => <FooterCol key={col.title} title={col.title} links={col.links} />)
        ) : (
          <>
            <FooterCol title={tx("Shop")} links={categories.filter((c) => c.menu !== false).map((c) => ({ label: c.name, href: `/shop/?category=${c.slug}` }))} />
            <FooterCol title={tx("Help")} links={[...Object.entries(pages).map(([slug, p]) => ({ label: p.title, href: `/pages/${slug}/` })), ...(pages["subscription-terms"] ? [] : [{ label: tx("Subscribe & save terms"), href: "/pages/subscription-terms/" }])]} />
          </>
        )}
        <div>
          <p className="mb-3 font-semibold text-white">{tx("Newsletter")}</p>
          <p className="text-sm">{tx("Offers, new arrivals and skincare tips.")}</p>
          <NewsletterForm dark />
          <p className="mt-5 text-xs text-white/50">We accept: {accepted}</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {store.name}. All rights reserved.
        <span className="mx-2" aria-hidden>·</span>
        Made by{" "}
        <a href="https://wa.me/96170797333" target="_blank" rel="noopener" aria-label="APOSTROPHE’ on WhatsApp" className="inline-flex items-center gap-1 font-semibold tracking-wide text-white/70 underline-offset-2 hover:text-white hover:underline">
          APOSTROPHE&rsquo;
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366" aria-hidden><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.88 9.88 0 0 0 12.04 2Zm5.8 14.16c-.24.68-1.42 1.3-1.95 1.34-.5.05-.97.23-3.27-.68-2.77-1.09-4.52-3.94-4.66-4.12-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.27.25-.27.54-.34.72-.34h.52c.17 0 .39-.06.61.47.24.56.79 1.92.86 2.06.07.14.11.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.28-.12.56.16.27.71 1.17 1.52 1.9 1.05.93 1.93 1.22 2.2 1.36.27.14.43.11.59-.07.16-.18.68-.79.86-1.07.18-.27.36-.23.61-.14.25.09 1.58.75 1.85.88.27.14.45.2.52.32.07.11.07.66-.17 1.34Z" /></svg>
        </a>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <p className="mb-3 font-semibold text-white">{title}</p>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-white">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FloatingWidgets() {
  const { store } = useSettings();
  const path = usePathname() ?? "";
  // On product, bag and checkout pages the phone already shows a sticky buy bar and an
  // "Ask a pharmacist" button, so the floating chat button would only cover the page.
  const busy = /^\/(products|cart|checkout|pay)\//.test(path);
  return (
    <a
      href={`https://wa.me/${store.whatsapp}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className={`fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] end-3 z-40 h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-lg hover:scale-105 md:bottom-5 md:end-5 md:h-14 md:w-14 hidden ${busy ? "" : "md:grid"}`}
    >
      <ChatIcon width={26} height={26} />
    </a>
  );
}
