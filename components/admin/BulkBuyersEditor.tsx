"use client";

import { useState } from "react";
import type { BulkBuyer } from "@/lib/bulk";

type Form = { phone: string; name: string; company: string; pct: number; maxUnits: number; minQty: number; notes: string; active: boolean; enquiry?: string };

export function BulkBuyersEditor({ initial, prefill, defaultPct }: { initial: BulkBuyer[]; prefill: { phone: string; name: string; company: string; enquiry: string }; defaultPct: number }) {
  const [list, setList] = useState(initial);
  const blank: Form = { phone: "", name: "", company: "", pct: Math.max(defaultPct, 15), maxUnits: 0, minQty: 1, notes: "", active: true };
  const [f, setF] = useState<Form | null>(prefill.phone || prefill.name ? { ...blank, ...prefill, enquiry: prefill.enquiry || undefined } : null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const save = async () => {
    if (!f) return;
    setErr("");
    const r = await fetch("/api/admin/bulk-buyers/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(d.error ?? "Couldn't save");
    setList((l) => [...l.filter((x) => x.phone !== d.buyer.phone), d.buyer].sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name)));
    setF(null);
  };
  const del = async (phone: string) => {
    if (!confirm("Remove this bulk buyer? They go back to normal prices.")) return;
    await fetch(`/api/admin/bulk-buyers/?phone=${encodeURIComponent(phone)}`, { method: "DELETE" });
    setList((l) => l.filter((x) => x.phone !== phone));
  };
  const toggle = async (b: BulkBuyer) => {
    const r = await fetch("/api/admin/bulk-buyers/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...b, active: !b.active }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setList((l) => l.map((x) => (x.phone === b.phone ? d.buyer : x)));
  };
  const shown = list.filter((b) => !q || `${b.company} ${b.name} ${b.phone} ${b.notes}`.toLowerCase().includes(q.toLowerCase()));
  const inp = "w-full rounded-lg border border-line px-3 py-2 text-sm";
  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setF(blank)} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">+ Add bulk buyer</button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, name or phone" className="w-72 rounded-full border border-line px-4 py-2 text-sm" />
      </div>
      {f && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="font-semibold">{list.some((x) => x.phone.endsWith(f.phone.replace(/\D/g, "").slice(-8)) && f.phone) ? "Edit bulk buyer" : "New bulk buyer"}{f.enquiry && <span className="ml-2 text-xs font-normal text-muted">from enquiry {f.enquiry}</span>}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-xs font-medium">Company<input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} className={inp} /></label>
            <label className="text-xs font-medium">Contact person<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} /></label>
            <label className="text-xs font-medium">Mobile (used at checkout) *<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="70 123 456" className={inp} /></label>
            <label className="text-xs font-medium">Discount %<input type="number" min={0} max={60} step={0.5} value={f.pct} onChange={(e) => setF({ ...f, pct: +e.target.value })} className={inp} /></label>
            <label className="text-xs font-medium">From quantity (per product)<input type="number" min={1} value={f.minQty} onChange={(e) => setF({ ...f, minQty: Math.max(1, +e.target.value) })} className={inp} /></label>
            <label className="text-xs font-medium">Discounted units per product a day (0 = no cap)<input type="number" min={0} value={f.maxUnits} onChange={(e) => setF({ ...f, maxUnits: Math.max(0, +e.target.value) })} className={inp} /></label>
            <label className="text-xs font-medium md:col-span-2">Notes (payment terms, VAT no., delivery…)<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={inp} /></label>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active</label>
          </div>
          {err && <p className="mt-2 text-sm text-sale">{err}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={save} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white">Save</button>
            <button onClick={() => setF(null)} className="rounded-full border border-line px-5 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-[#f6f1f3] text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="p-3">Company / person</th><th className="p-3">Mobile</th><th className="p-3">Discount</th><th className="p-3">From qty</th><th className="p-3">Daily cap</th><th className="p-3">Notes</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {shown.map((b) => (
              <tr key={b.phone} className="border-t border-line">
                <td className="p-3"><p className="font-semibold">{b.company || b.name}</p>{b.company && b.name && <p className="text-xs text-muted">{b.name}</p>}</td>
                <td className="p-3"><a href={`https://wa.me/${b.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-brand-700">{b.phone}</a></td>
                <td className="p-3 font-semibold">{b.pct}%</td>
                <td className="p-3">{b.minQty}+</td>
                <td className="p-3">{b.maxUnits || "No cap"}</td>
                <td className="max-w-xs p-3 text-xs text-muted">{b.notes}</td>
                <td className="p-3"><button onClick={() => toggle(b)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${b.active ? "bg-[#e6f4ee] text-[#046c4e]" : "bg-[#f1f1f1] text-muted"}`}>{b.active ? "Active" : "Paused"}</button></td>
                <td className="whitespace-nowrap p-3 text-right">
                  <button onClick={() => setF({ ...b, enquiry: b.enquiry })} className="text-brand-700">Edit</button>
                  <button onClick={() => del(b.phone)} className="ml-3 text-sale">Remove</button>
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={8} className="p-8 text-center text-muted">No bulk buyers yet. Approve one from a wholesale enquiry, or add one here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
