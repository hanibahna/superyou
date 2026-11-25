"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Orders page: place a test order in one click (a supplier product, cash on delivery), or clear all test orders. */
export function TestOrderButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const go = async (action: "create" | "clear") => {
    if (action === "clear" && !confirm("Delete all test orders? Real orders are not touched.")) return;
    setBusy(action);
    const r = await fetch("/api/admin/test-order/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy("");
    if (!r?.ok) return alert(d.error ?? "Failed");
    router.push(action === "create" && d.id ? `/admin/orders/${d.id}/` : "/admin/orders/?tab=test");
    router.refresh();
  };
  return (
    <>
      <button disabled={!!busy} onClick={() => go("create")} className="rounded-lg bg-[#f59e0b] px-3 py-2 font-semibold text-white disabled:opacity-60">{busy === "create" ? "Creating…" : "🧪 Test order"}</button>
      <button disabled={!!busy} onClick={() => go("clear")} className="rounded-lg border border-line bg-white px-3 py-2 font-semibold disabled:opacity-60">Clear test orders</button>
    </>
  );
}
