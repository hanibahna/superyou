"use client";

// Price guarantee: this item was cheaper at another shop, so SuperYou matched that price.
import { useT } from "@/lib/site-context";

export function PriceMatchBadge({ p, size = "sm", className = "" }: { p: { match?: string }; size?: "sm" | "md"; className?: string }) {
  const t = useT();
  if (p.match === undefined) return null;
  const cls = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  const text = p.match ? `${t("Price matched")} · ${p.match}` : t("Price matched");
  const title = p.match ? `${t("We found it for less at")} ${p.match} ${t("and matched their price.")}` : t("We found it for less at another shop and matched the price.");
  return (
    <span title={title} className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full bg-[#fff4e5] font-semibold text-[#8a4b00] ${cls} ${className}`}>
      <span aria-hidden>✓</span>
      {text}
    </span>
  );
}

/** One line under the order summary when at least one item was price-matched. */
export function PriceGuaranteeNote({ items, className = "" }: { items: { match?: string }[]; className?: string }) {
  const t = useT();
  const shops = [...new Set(items.map((i) => i.match).filter((m): m is string => m !== undefined))];
  if (!shops.length) return null;
  const named = shops.filter(Boolean);
  return (
    <p className={`rounded-lg bg-[#fff4e5] p-3 text-xs leading-relaxed text-[#8a4b00] ${className}`}>
      <b>{t("Price guarantee.")}</b> {named.length ? `${t("We matched the lower price at")} ${named.join(", ")}.` : t("We matched a lower price we found at another shop.")} {t("We check other shops in Lebanon every night.")}
    </p>
  );
}
