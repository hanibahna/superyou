"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "./fields";

type P = { legacy: boolean; pct: number; need: number; done: number; unlocked: boolean; noRebate?: boolean; rebate: { earned: number; used: number; pending: number; forfeited: number } };
type S = { id: string; status: string; every: number; nextAt: string; name: string; phone: string; items: string; orders: string[]; lastError: string; link: string; progress: P; flags: string[]; log: { at: string; text: string }[] };
type Rules = { monthly: number; quarterly: number; unlockMonthly: number; unlockQuarterly: number; maxRebate: number; cooldownDays: number };

export function SubscriptionsAdmin({ subs, rules }: { subs: S[]; rules: Rules }) {
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("active");
  const call = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/admin/subscriptions/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (body.action === "run") setMsg(`Reminders sent: ${d.reminded ?? 0} · orders placed: ${d.placed ?? 0} · problems: ${d.failed ?? 0}`);
    else location.reload();
  };
  const shown = subs.filter((s) => filter === "all" || s.status === filter);
  const active = subs.filter((s) => s.status === "active");
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Subscriptions</h1>
          <p className="mt-1 text-sm text-muted">Subscribe & save customers. Orders are placed automatically each morning on the due date (cash on delivery), with a WhatsApp reminder 3 days before. Discounts are set in Growth → Tools.</p>
        </div>
        <button onClick={() => call({ action: "run" })} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">Run today's subscriptions now</button>
      </div>
      {msg && <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm">{msg}</p>}
      <p className="mt-3 rounded-lg bg-[#f6f1f3] p-3 text-sm"><b>Earn-it rules:</b> the first orders are full price. Monthly unlocks {rules.monthly}% after {rules.unlockMonthly} delivered orders, every 3 months unlocks {rules.quarterly}% after {rules.unlockQuarterly}. On unlock the customer gets the same % back on the orders already delivered, used on the next subscription orders (max ${rules.maxRebate} per order), never as cash. Returns and cancellations reverse it; cancelling forfeits unused rebate; re-subscribing within {rules.cooldownDays} days earns no rebate. Older subscriptions keep their discount. Change these in Growth → Tools.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Card title="Active"><p className="text-3xl font-bold">{active.length}</p></Card>
        <Card title="Monthly / longer plans"><p className="text-3xl font-bold">{active.filter((s) => s.every === 1).length} / {active.filter((s) => s.every !== 1).length}</p></Card>
        <Card title="Rebates owed / flagged"><p className="text-3xl font-bold">${active.reduce((a, s) => a + s.progress.rebate.pending, 0).toFixed(0)} / {active.filter((s) => s.flags.length).length}</p></Card>
        <Card title="Due in the next 7 days"><p className="text-3xl font-bold">{active.filter((s) => s.nextAt <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)).length}</p></Card>
      </div>
      <div className="mt-5">
        <Card title={`Subscriptions (${shown.length})`} actions={<select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-line px-2 py-1.5 text-sm">{["active", "paused", "cancelled", "all"].map((f) => <option key={f}>{f}</option>)}</select>}>
          {!shown.length ? <p className="text-sm text-muted">None yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead><tr className="text-left text-muted"><th className="py-2">Customer</th><th>Items</th><th>Plan</th><th>Next order</th><th>Discount</th><th>Orders</th><th></th></tr></thead>
                <tbody className="divide-y divide-line">
                  {shown.map((s) => (
                    <tr key={s.id} className="align-top">
                      <td className="py-3"><b>{s.name}</b><br /><a className="text-muted underline" href={`https://wa.me/${s.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{s.phone}</a></td>
                      <td className="max-w-[260px] py-3">{s.items}{s.lastError && <p className="mt-1 text-xs text-sale">{s.lastError}</p>}</td>
                      <td className="py-3">{s.every === 1 ? "Monthly" : `Every ${s.every} months`}<br /><span className="text-xs text-muted">{s.status}</span></td>
                      <td className="py-3"><input type="date" defaultValue={s.nextAt} onChange={(e) => e.target.value && call({ id: s.id, action: "date", date: e.target.value })} className="rounded-lg border border-line px-2 py-1" aria-label="Next order date" /></td>
                      <td className="max-w-[240px] py-3 text-xs">
                        {s.progress.legacy ? <span>Older plan: −{s.progress.pct}% always</span> : s.progress.unlocked ? <span className="font-semibold text-green-700">Unlocked −{s.progress.pct}%</span> : <span><b>{s.progress.done} of {s.progress.need}</b> deliveries</span>}
                        {!s.progress.legacy && <p className="text-muted">Rebate: earned ${s.progress.rebate.earned.toFixed(2)} · used ${s.progress.rebate.used.toFixed(2)} · <b>owed ${s.progress.rebate.pending.toFixed(2)}</b>{s.progress.rebate.forfeited ? ` · forfeited $${s.progress.rebate.forfeited.toFixed(2)}` : ""}</p>}
                        {s.flags.map((f) => <p key={f} className="mt-0.5 rounded bg-amber-100 px-1.5 py-0.5">⚑ {f}</p>)}
                        {s.log.length > 0 && <details className="mt-1"><summary className="cursor-pointer text-muted">History</summary>{s.log.map((l) => <p key={l.at + l.text} className="text-muted">{l.at.slice(0, 10)}: {l.text}</p>)}</details>}
                      </td>
                      <td className="py-3">{s.orders.map((o) => <Link key={o} href={`/admin/orders/${o}/`} className="block underline">{o}</Link>)}</td>
                      <td className="space-y-1 py-3 text-right">
                        {s.status === "active" && <button onClick={() => call({ id: s.id, action: "skip" })} className="block w-full rounded-lg border border-line px-2 py-1">Skip next</button>}
                        {s.status === "active" ? <button onClick={() => call({ id: s.id, action: "pause" })} className="block w-full rounded-lg border border-line px-2 py-1">Pause</button> : s.status === "paused" && <button onClick={() => call({ id: s.id, action: "resume" })} className="block w-full rounded-lg border border-line px-2 py-1">Resume</button>}
                        {s.progress.rebate.pending > 0 && <button onClick={() => confirm(`Void the $${s.progress.rebate.pending.toFixed(2)} rebate this customer is owed?`) && call({ id: s.id, action: "void" })} className="block w-full rounded-lg border border-line px-2 py-1 text-xs">Void rebate</button>}
                        {s.status !== "cancelled" && <button onClick={() => confirm("Cancel this subscription?") && call({ id: s.id, action: "cancel" })} className="block w-full rounded-lg px-2 py-1 text-sale">Cancel</button>}
                        <button onClick={() => navigator.clipboard.writeText(s.link)} className="block w-full rounded-lg px-2 py-1 text-xs text-muted">Copy customer link</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
