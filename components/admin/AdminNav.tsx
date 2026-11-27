"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { areaOf, can, roleInfo, type Role } from "@/lib/roles";

const groups: { title: string; links: { href: string; label: string }[] }[] = [
  { title: "", links: [{ href: "/admin/", label: "Dashboard" }, { href: "/admin/orders/", label: "Orders" }, { href: "/admin/sales/", label: "Sales" }, { href: "/admin/bookings/", label: "Bookings & sign-ups" }, { href: "/admin/subscriptions/", label: "Subscriptions" }, { href: "/admin/lifespans/", label: "How long products last" }, { href: "/admin/influencers/", label: "Referrals & influencers" }, { href: "/admin/calls/", label: "Calls & appointments" }, { href: "/admin/sections/", label: "Sections & AI" }] },
  {
    title: "Orders & stock",
    links: [
      { href: "/admin/inventory/", label: "Inventory" },
      { href: "/admin/orders/pickup/", label: "Pickup sheet" },
      { href: "/admin/payables/", label: "Payables & courier cash" },
      { href: "/admin/wholesale/", label: "Wholesale enquiries" },
      { href: "/admin/bulk-buyers/", label: "Bulk buyers" },
      { href: "/admin/carts/", label: "Abandoned carts" },
      { href: "/admin/giftcards/", label: "Gift cards" },
    ],
  },
  {
    title: "Catalog",
    links: [
      { href: "/admin/products/", label: "Products" },
      { href: "/admin/taxonomy/", label: "Categories & concerns" },
      { href: "/admin/collections/", label: "Collections" },
      { href: "/admin/visibility/", label: "Catalog visibility" },
      { href: "/admin/sourcing/", label: "Sourcing: local & imported" },
      { href: "/admin/margins/", label: "Margins" },
      { href: "/admin/import/", label: "Import / export" },
    ],
  },
  {
    title: "Marketing",
    links: [
      { href: "/admin/marketing/", label: "Campaigns & ads" },
      { href: "/admin/growth/", label: "Growth & loyalty" },
      { href: "/admin/promotions/", label: "Discounts & free gifts" },
      { href: "/admin/black-friday/", label: "Black Friday" },
      { href: "/admin/reviews/", label: "Reviews" },
      { href: "/admin/club/", label: "Club members & codes" },
      { href: "/admin/whatsapp/", label: "WhatsApp" },
      { href: "/admin/sms/", label: "SMS" },
      { href: "/admin/app/", label: "Mobile app & push" },
      { href: "/admin/videos/", label: "Video library" },
      { href: "/admin/routine/", label: "Routine finder" },
      { href: "/admin/services/", label: "Services & events" },
      { href: "/admin/subscribers/", label: "Subscribers" },
    ],
  },
  {
    title: "Online store",
    links: [
      { href: "/admin/homepage/", label: "Homepage" },
      { href: "/admin/navigation/", label: "Navigation" },
      { href: "/admin/appearance/", label: "Themes & colours" },
      { href: "/admin/search/", label: "Search & filters" },
      { href: "/admin/translations/", label: "Languages & translations" },
      { href: "/admin/settings/", label: "Settings" },
      { href: "/admin/operations/", label: "Operations" },
    ],
  },
  {
    title: "Team",
    links: [
      { href: "/admin/staff/", label: "Staff accounts" },
      { href: "/admin/security/", label: "My sign-in security" },
      { href: "/admin/activity/", label: "Activity log" },
      { href: "/admin/help/", label: "Help & guides" },
    ],
  },
];

export function AdminNav({ role, name }: { role: Role; name: string }) {
  const path = usePathname();
  // Black Friday test mode: a blinking marker so it isn't forgotten (turn it off in Marketing → Black Friday).
  const [bfTest, setBfTest] = useState(false);
  useEffect(() => { fetch("/api/admin/black-friday/?test=1").then((r) => (r.ok ? r.json() : null)).then((j) => setBfTest(!!j?.on)).catch(() => {}); }, [path]);
  const all = groups.flatMap((g) => g.links.map((l) => l.href));
  // The most specific link wins (Orders vs Pickup sheet).
  const best = all.filter((h) => (h === "/admin/" ? path === "/admin" || path === "/admin/" : path.startsWith(h.replace(/\/$/, "")))).sort((a, b) => b.length - a.length)[0];
  const active = (href: string) => href === best;
  const visible = groups.map((g) => ({ ...g, links: g.links.filter((l) => can(role, areaOf(l.href))) })).filter((g) => g.links.length);
  return (
    <aside className="bg-ink text-white/80 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto print:hidden">
      <style>{"@keyframes bfblink{0%,100%{opacity:1}50%{opacity:.3}}"}</style>
      {bfTest && <Link href="/admin/black-friday/" className="block bg-red-600 px-4 py-2 text-center text-xs font-bold text-white" style={{ animation: "bfblink 1s ease-in-out infinite" }}>● Black Friday TEST MODE is on · turn off</Link>}
      <div className="flex items-center justify-between px-5 py-5 lg:block">
        <Link href="/admin/" className="text-xl font-extrabold text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/superyou-logo-white.svg" alt="SuperYou" className="inline h-4 w-auto" />{" "}
          <span className="text-xs font-medium text-white/50">admin</span>
        </Link>
        <p className="hidden pt-2 text-xs text-white/50 lg:block">{name} · {roleInfo[role].label}</p>
      </div>
      <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 text-sm lg:flex-col lg:pb-0">
        {visible.map((g) => (
          <div key={g.title} className="contents lg:block">
            {g.title && <p className="hidden px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-white/40 lg:block">{g.title}</p>}
            {g.links.map((l) => (
              <Link key={l.href} href={l.href} className={`block shrink-0 rounded-lg px-3 py-2 ${active(l.href) ? "bg-white/10 font-semibold text-white" : "hover:bg-white/5 hover:text-white"}`}>
                {l.label}
                {bfTest && l.href === "/admin/black-friday/" && <span className="ms-2 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white" style={{ animation: "bfblink 1s ease-in-out infinite" }}>TEST</span>}
              </Link>
            ))}
          </div>
        ))}
        <a href="/" target="_blank" className="shrink-0 rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white">View shop ↗</a>
        <button
          onClick={async () => {
            await fetch("/api/admin/logout/", { method: "POST" });
            window.location.href = "/admin/login/";
          }}
          className="shrink-0 rounded-lg px-3 py-2 text-left hover:bg-white/5 hover:text-white lg:mt-4"
        >
          Sign out
        </button>
      </nav>
    </aside>
  );
}
