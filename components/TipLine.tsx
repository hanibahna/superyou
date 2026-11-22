"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/site-context";

/** Slim ad + rotating tip strip for product pages (content from the product's section). */
export function TipLine({ tips, banner }: { tips: string[]; banner: { title: string; cta: string; href: string; bg: string } }) {
  const t = useT();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (tips.length < 2) return;
    const x = setInterval(() => setI((n) => (n + 1) % tips.length), 7000);
    return () => clearInterval(x);
  }, [tips.length]);
  return (
    <div className="mb-5 grid gap-2 md:grid-cols-[1fr_auto]">
      {tips.length > 0 && <p className="flex min-h-[44px] items-center gap-2 rounded-2xl bg-[#f6f1f3] px-4 py-2 text-sm"><b className="shrink-0 text-brand-700">{t("Tip")}</b><span key={i}>{t(tips[i % tips.length])}</span></p>}
      {banner.href && <Link href={banner.href} className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl px-4 py-2 text-sm font-semibold" style={{ background: banner.bg || "#fcf1f4" }}>{t(banner.title)}<span className="shrink-0 underline">{t(banner.cta)} →</span></Link>}
    </div>
  );
}
