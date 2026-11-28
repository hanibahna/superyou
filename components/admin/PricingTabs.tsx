"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// One row of tabs across every Pricing page, so margins, discounts, Black Friday and SuperPrice sit together.
const TABS = [
  { href: "/admin/pricing/", label: "Overview" },
  { href: "/admin/margins/", label: "Margins & costs" },
  { href: "/admin/promotions/", label: "Discounts & codes" },
  { href: "/admin/black-friday/", label: "Black Friday" },
  { href: "/admin/superprice/", label: "SuperPrice" },
];

export function PricingTabs() {
  const path = usePathname();
  return (
    <div className="mb-5">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">Pricing</p>
      <nav className="no-scrollbar flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const on = path.startsWith(t.href.replace(/\/$/, ""));
          return <Link key={t.href} href={t.href} className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${on ? "bg-ink text-white" : "bg-white hover:bg-white/70"}`}>{t.label}</Link>;
        })}
      </nav>
    </div>
  );
}
