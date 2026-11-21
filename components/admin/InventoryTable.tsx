"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { imgUrl } from "@/lib/img";

type Row = { id: string; name: string; brand: string; variant?: string; sku: string; stock?: number; image?: string; status: string };
const REASONS = ["Stock count", "Delivery received", "Damaged / expired", "Used as tester", "Sold in store", "Correction"];

export function InventoryTable({ rows, lowAt, more }: { rows: Row[]; lowAt: number; more: number }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"set" | "add">("set");
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const changes = Object.entries(edits).filter(([, v]) => v.trim() !== "" && !Number.isNaN(Number(v)));

  async function save() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin/inventory/", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, changes: changes.map(([productId, v]) => (mode === "set" ? { productId, set: Math.max(0, Math.round(Number(v))) } : { productId, delta: Math.round(Number(v)) })) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setEdits({});
      setMsg(`Saved ✓ (${data.changed} updated)`);
      router.refresh();
    } else setMsg(data.error ?? "Could not save");
  }

  return (
    <div className="rounded-xl bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-3 text-sm">
        <div className="flex overflow-hidden rounded-lg border border-line">
          <button onClick={() => setMode("set")} className={`px-3 py-1.5 ${mode === "set" ? "bg-ink text-white" : ""}`}>Set the count</button>
          <button onClick={() => setMode("add")} className={`px-3 py-1.5 ${mode === "add" ? "bg-ink text-white" : ""}`}>Add / remove</button>
        </div>
        <label className="flex items-center gap-2">Reason
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-lg border border-line px-2 py-1.5">{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
        </label>
        <span className="ms-auto text-muted">{msg}</span>
        <button onClick={save} disabled={busy || !changes.length} className="rounded-lg bg-brand-500 px-4 py-1.5 font-semibold text-white disabled:opacity-40">{busy ? "Saving…" : `Save ${changes.length || ""} change${changes.length === 1 ? "" : "s"}`}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted"><tr><th className="p-3">Product</th><th className="p-3">SKU</th><th className="p-3 text-right">In stock</th><th className="w-36 p-3">{mode === "set" ? "New count" : "+ / −"}</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="p-3">
                  <Link href={`/admin/products/${p.id}/`} className="flex items-center gap-3 hover:underline">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgUrl(p.image, 80)} alt="" className="h-9 w-9 rounded object-contain" />
                    ) : <span className="h-9 w-9 rounded bg-[#f1f2f1]" />}
                    <span><span className="text-muted">{p.brand}</span> {p.name}{p.variant ? <span className="text-muted"> · {p.variant}</span> : null}{p.status !== "active" && <span className="ms-1 rounded bg-[#eee] px-1 text-[10px]">draft</span>}</span>
                  </Link>
                </td>
                <td className="p-3 font-mono text-xs text-muted">{p.sku}</td>
                <td className={`p-3 text-right font-semibold ${p.stock === 0 ? "text-sale" : p.stock !== undefined && p.stock <= lowAt ? "text-amber-600" : ""}`}>{p.stock ?? <span className="font-normal text-muted">not counted</span>}</td>
                <td className="p-3">
                  <input inputMode="numeric" value={edits[p.id] ?? ""} onChange={(e) => setEdits((x) => ({ ...x, [p.id]: e.target.value.replace(/[^\d-]/g, "") }))} placeholder={mode === "set" ? String(p.stock ?? "") : "e.g. 12 or -2"} aria-label={`New count for ${p.name}`} className="w-full rounded-lg border border-line px-2 py-1.5" />
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="p-10 text-center text-muted">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>
      {more > 0 && <p className="border-t border-line p-3 text-xs text-muted">{more} more — search to narrow the list.</p>}
    </div>
  );
}
