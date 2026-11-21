"use client";

import { StarIcon } from "./Icons";

// ── Stars ──
export function Stars({ value, count, size = 13 }: { value: number; count?: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-ink" aria-label={`${value.toFixed(1)} out of 5 stars${count ? `, ${count} reviews` : ""}`}>
      {[1, 2, 3, 4, 5].map((i) => <StarIcon key={i} width={size} height={size} filled={value >= i - 0.25} className={value >= i - 0.25 ? "" : "text-line"} />)}
      {count !== undefined && <span className="ms-1 text-[11px] text-muted">({count})</span>}
    </span>
  );
}

