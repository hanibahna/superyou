"use client";

import Link from "next/link";
import type { Category } from "@/lib/data/catalog";
import { useGrowth, useSettings, useT } from "@/lib/site-context";
import { NewsletterForm } from "./NewsletterForm";
import { ChatIcon, GiftIcon, ShieldIcon, TruckIcon } from "./Icons";

export function TrustStrip() {
  const { trust } = useSettings();
  const icons = [<ShieldIcon key="s" />, <TruckIcon key="t" />, <GiftIcon key="g" />, <ChatIcon key="c" />];
  const items = trust.filter((t) => t.title).map((t, n) => ({ ...t, icon: icons[n % icons.length] }));
  if (!items.length) return null;
  return (
    <section className="border-y border-line bg-brand-50">
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
    <footer className="bg-ink text-white/80">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/superyou-logo-white.svg" alt={store.name} className="h-6 w-auto" />
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
            <FooterCol title={tx("Help")} links={Object.entries(pages).map(([slug, p]) => ({ label: p.title, href: `/pages/${slug}/` }))} />
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
  const growth = useGrowth();
  return (
    <>
      <a
        href={`https://wa.me/${store.whatsapp}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-32 end-4 z-40 grid h-12 w-12 md:bottom-5 md:end-5 md:h-14 md:w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg hover:scale-105"
      >
        <ChatIcon width={26} height={26} />
      </a>
      {growth.club.enabled && (
        <Link href="/club/" aria-label={growth.club.name} className="fixed bottom-5 start-5 z-40 hidden items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white shadow-lg md:flex">
          <GiftIcon width={18} height={18} /> {growth.club.name}
        </Link>
      )}
    </>
  );
}
