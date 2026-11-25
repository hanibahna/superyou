"use client";

import Link from "next/link";
import { useState } from "react";

type P = { id: string; amount: number; at: string; supplier?: string; courier?: string; paidAt?: string; settledAt?: string };
const m = (n: number) => `$${n.toFixed(2)}`;
const d = (s: string) => new Date(s).toLocaleDateString("en-GB", { timeZone: "Asia/Beirut", day: "numeric", month: "short", year: "numeric" });
// Week starting Monday (Beirut), for weekly totals.
const week = (s: string) => { const x = new Date(s); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day); return x.toISOString().slice(0, 10); };

function Table({ title, rows, done, action, label }: { title: string; rows: P[]; done: (r: P) => string | undefined; action: string; label: string }) {
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const open = rows.filter((r) => !done(r));
  const weeks = new Map<string, number>();
  for (const r of open) weeks.set(week(r.at), (weeks.get(week(r.at)) ?? 0) + r.amount);
  const go = async () => {
    setBusy(true);
    await fetch("/api/admin/fulfil/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ids: sel }) });
    location.reload();
  };
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm">Open: <b>{m(open.reduce((s, r) => s + r.amount, 0))}</b> on {open.length} orders</p>
      </div>
      {weeks.size > 0 && <p className="mt-1 text-xs text-muted">By week: {[...weeks].sort().map(([w, v]) => `w/c ${d(w)} ${m(v)}`).join(" · ")}</p>}
      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-xs text-muted"><tr><th className="w-8" /><th className="py-1">Order</th><th>Delivered</th><th className="text-right">Amount</th><th>Status</th></tr></thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{!done(r) && <input type="checkbox" checked={sel.includes(r.id)} onChange={(e) => setSel((x) => (e.target.checked ? [...x, r.id] : x.filter((y) => y !== r.id)))} />}</td>
              <td className="py-1.5 font-mono text-xs"><Link href={`/admin/orders/${r.id}/`} className="underline">{r.id}</Link></td>
              <td>{d(r.at)}</td>
              <td className="text-right font-semibold">{m(r.amount)}</td>
              <td>{done(r) ? <span className="text-[#046c4e]">✓ {d(done(r)!)}</span> : <span className="text-sale">Open</span>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="py-6 text-center text-muted">Nothing yet. Entries appear when orders are delivered.</td></tr>}
        </tbody>
      </table>
      {sel.length > 0 && <button disabled={busy} onClick={go} className="mt-3 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">{label} ({sel.length}) · {m(rows.filter((r) => sel.includes(r.id)).reduce((s, r) => s + r.amount, 0))}</button>}
    </section>
  );
}

export function PayablesView({ pay, cash }: { pay: P[]; cash: P[] }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Payables &amp; courier cash</h1>
      <Table title={`Due to ${pay[0]?.supplier ?? "the supplier"}`} rows={pay} done={(r) => r.paidAt} action="paid" label="Mark paid" />
      <Table title={`Cash collected by ${cash[0]?.courier ?? "the courier"}`} rows={cash} done={(r) => r.settledAt} action="settle" label="Mark handed over" />
    </div>
  );
}
