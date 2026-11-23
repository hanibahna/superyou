"use client";

import { useState } from "react";

/** One-off: product web addresses that carry a supplier code ("-sks-123…") get clean ones. */
export function CleanSlugs({ count }: { count: number }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (!count && !msg) return null;
  const run = async () => {
    if (!confirm(`Give ${count} products clean web addresses (brand + name)? Old addresses redirect automatically; reviews, videos and how-to guides move with them.`)) return;
    setBusy(true);
    const r = await fetch("/api/admin/catalog/clean-slugs/", { method: "POST" }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    setMsg(r?.ok ? `Done: ${d.moved} addresses cleaned, ${d.reviews} reviews moved. Old links redirect.` : d.error ?? "Something went wrong. Try again.");
  };
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 p-3 text-sm">
      <span>{msg || `${count} product web addresses still contain a supplier code (…-sks-…). Clean them to brand + name.`}</span>
      {!msg && <button onClick={run} disabled={busy} className="rounded-lg bg-ink px-3 py-1.5 font-semibold text-white disabled:opacity-50">{busy ? "Cleaning…" : "Clean product links"}</button>}
    </div>
  );
}
