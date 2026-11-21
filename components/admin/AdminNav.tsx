"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const groups: { title: string; links: { href: string; label: string }[] }[] = [
  { title: "", links: [{ href: "/admin/", label: "Dashboard" }, { href: "/admin/orders/", label: "Orders" }, { href: "/admin/bookings/", label: "Bookings & sign-ups" }] },
  {
    title: "Catalog",
    links: [
      { href: "/admin/products/", label: "Products" },
      { href: "/admin/taxonomy/", label: "Categories & concerns" },
      { href: "/admin/collections/", label: "Collections" },
      { href: "/admin/visibility/", label: "Catalog visibility" },
      { href: "/admin/import/", label: "Import / export" },
    ],
  },
  {
    title: "Marketing",
    links: [
      { href: "/admin/growth/", label: "Growth & loyalty" },
      { href: "/admin/promotions/", label: "Discounts & free gifts" },
      { href: "/admin/reviews/", label: "Reviews" },
      { href: "/admin/club/", label: "Club members & codes" },
      { href: "/admin/whatsapp/", label: "WhatsApp" },
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
      { href: "/admin/help/", label: "Help & guides" },
    ],
  },
];

export function AdminNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/admin/" ? path === "/admin" || path === "/admin/" : path.startsWith(href.replace(/\/$/, "")));
  return (
    <aside className="bg-ink text-white/80 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-5 lg:block">
        <Link href="/admin/" className="text-xl font-extrabold text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/superyou-logo-white.svg" alt="SuperYou" className="inline h-4 w-auto" />{" "}
          <span className="text-xs font-medium text-white/50">admin</span>
        </Link>
      </div>
      <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 text-sm lg:flex-col lg:pb-0">
        {groups.map((g) => (
          <div key={g.title} className="contents lg:block">
            {g.title && <p className="hidden px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-white/40 lg:block">{g.title}</p>}
            {g.links.map((l) => (
              <Link key={l.href} href={l.href} className={`block shrink-0 rounded-lg px-3 py-2 ${active(l.href) ? "bg-white/10 font-semibold text-white" : "hover:bg-white/5 hover:text-white"}`}>
                {l.label}
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
