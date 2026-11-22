"use client";

// Where an item ships from and how long it takes: local stock (Lebanon) or imported for the customer.
import { useT } from "@/lib/site-context";

type Ship = { origin?: "local" | "international"; shipFrom?: string; daysMin?: number; daysMax?: number };

export function ShipBadge({ p, size = "sm", className = "" }: { p: Ship; size?: "sm" | "md"; className?: string }) {
  const t = useT();
  if (!p.origin) return null;
  const days = p.daysMin && p.daysMax ? (p.daysMin === p.daysMax ? `${p.daysMax}` : `${p.daysMin}–${p.daysMax}`) : "";
  const intl = p.origin === "international";
  const cls = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${cls} ${intl ? "bg-[#eef2ff] text-[#3730a3]" : "bg-[#ecfdf3] text-[#046c4e]"} ${className}`}>
      <span aria-hidden>{intl ? "✈" : "●"}</span>
      {intl ? `${t("Imported")}${p.shipFrom ? ` · ${p.shipFrom}` : ""}` : t("Ships from Lebanon")}
      {days && <span className="font-medium opacity-80">· {days} {t("days")}</span>}
    </span>
  );
}

/** When a bag mixes Lebanese stock and imported items, say plainly that they arrive separately. */
export function DeliverySplit({ items, className = "" }: { items: Ship[]; className?: string }) {
  const t = useT();
  const local = items.filter((p) => p.origin !== "international");
  const intl = items.filter((p) => p.origin === "international");
  if (!intl.length) return null;
  const max = (a: Ship[]) => Math.max(...a.map((p) => p.daysMax ?? 0));
  const min = (a: Ship[]) => Math.min(...a.map((p) => p.daysMin ?? 0));
  const range = (a: Ship[]) => (min(a) === max(a) ? `${max(a)}` : `${min(a)}–${max(a)}`);
  return (
    <div className={`rounded-xl border border-line bg-[#fafafa] p-3 text-xs leading-relaxed ${className}`}>
      <p className="mb-1 font-semibold">{local.length ? t("Your order arrives in two parts") : t("Imported for you")}</p>
      {local.length > 0 && <p><span className="text-[#046c4e]">●</span> {local.length} {t("from Lebanon")}: {range(local)} {t("working days")}</p>}
      <p><span className="text-[#3730a3]">✈</span> {intl.length} {t("imported")}: {range(intl)} {t("working days")}. {t("Shipping, customs duty and VAT are already in the price.")}</p>
    </div>
  );
}
