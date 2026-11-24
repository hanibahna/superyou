"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type V = { id: string; status: "active" | "paused" | "cancelled"; every: number; items: { productId: string; qty: number; name: string }[]; nextAt: string; orders: number; name: string; city: string; progress?: { legacy: boolean; pct: number; need: number; done: number; unlocked: boolean; noRebate?: boolean; rebate: { pending: number; used: number } } };
const pretty = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });

export default function Page() {
  return <Suspense fallback={<p className="container-x py-16 text-muted">Loading…</p>}><Manage /></Suspense>;
}

function Manage() {
  const sp = useSearchParams();
  const id = sp.get("id") ?? "", t = sp.get("t") ?? "";
  const [s, setS] = useState<V | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(`/api/subscriptions/?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setS).catch(() => setMissing(true)); }, [id, t]);
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    const r = await fetch("/api/subscriptions/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, t, ...body }) });
    if (r.ok) setS(await r.json());
    setBusy(false);
  };
  if (missing) return <p className="container-x py-16 text-center text-muted">We couldn't find this subscription. Check the link in your WhatsApp message.</p>;
  if (!s) return <p className="container-x py-16 text-muted">Loading…</p>;
  const on = s.status === "active";
  return (
    <div className="container-x max-w-2xl py-10">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Subscribe & save</p>
      <h1 className="mt-2 text-4xl font-bold">Hi {s.name}, your subscription</h1>
      <div className="mt-6 rounded-3xl bg-[#f6f1f3] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{s.status === "cancelled" ? "Cancelled" : s.status === "paused" ? "Paused" : "Next order"}</p>
            {s.status !== "cancelled" && <p className="text-2xl font-bold">{on ? pretty(s.nextAt) : "On hold"}</p>}
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${on ? "bg-green-100 text-green-900" : s.status === "paused" ? "bg-amber-100 text-amber-900" : "bg-gray-200"}`}>{s.status}</span>
        </div>
        {s.status !== "cancelled" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold">Deliver every</span>
              <select value={s.every} disabled={busy} onChange={(e) => act({ action: "every", every: Number(e.target.value) })} className="mt-1 min-h-[48px] w-full rounded-2xl border border-line bg-white px-3 font-semibold">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((e) => <option key={e} value={e}>{e === 1 ? "1 month" : `${e} months`}</option>)}
              </select>
            </label>
            {on && (
              <label className="block">
                <span className="text-sm font-semibold">Next delivery on</span>
                <input type="date" value={s.nextAt} disabled={busy} min={new Date(Date.now() + 864e5).toISOString().slice(0, 10)} max={new Date(Date.now() + 395 * 864e5).toISOString().slice(0, 10)} onChange={(e) => e.target.value && act({ action: "date", date: e.target.value })} className="mt-1 min-h-[48px] w-full rounded-2xl border border-line bg-white px-3 font-semibold" />
              </label>
            )}
          </div>
        )}
      </div>

      <h2 className="mt-8 text-xl font-bold">In each delivery</h2>
      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
        {s.items.map((i) => (
          <li key={i.productId} className="flex items-center gap-3 p-4">
            <span className="min-w-0 flex-1 font-medium">{i.name}</span>
            {s.status !== "cancelled" && (
              <>
                <label className="sr-only" htmlFor={`q-${i.productId}`}>Quantity</label>
                <select id={`q-${i.productId}`} value={i.qty} disabled={busy} onChange={(e) => act({ action: "qty", productId: i.productId, qty: Number(e.target.value) })} className="min-h-[44px] rounded-xl border border-line px-2">{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select>
                <button disabled={busy} onClick={() => act({ action: "remove", productId: i.productId })} className="min-h-[44px] px-2 text-sm text-sale">Remove</button>
              </>
            )}
          </li>
        ))}
      </ul>

      {s.status !== "cancelled" && (
        <div className="mt-6 flex flex-wrap gap-2">
          {on && <button disabled={busy} onClick={() => act({ action: "skip" })} className="min-h-[48px] rounded-full border border-ink px-5 font-semibold">Skip the next order</button>}
          {on ? <button disabled={busy} onClick={() => act({ action: "pause" })} className="min-h-[48px] rounded-full border border-line px-5 font-semibold">Pause</button> : <button disabled={busy} onClick={() => act({ action: "resume" })} className="min-h-[48px] rounded-full bg-ink px-5 font-semibold text-white">Resume</button>}
          <button disabled={busy} onClick={() => confirm("Cancel this subscription?") && act({ action: "cancel" })} className="min-h-[48px] rounded-full px-5 font-semibold text-sale">Cancel subscription</button>
        </div>
      )}
      {s.progress && !s.progress.legacy && s.status !== "cancelled" && (
        <div className="mt-6 rounded-2xl border-2 border-[#d13f74]/30 bg-[#fdf6f8] p-4">
          {s.progress.unlocked ? (
            <>
              <p className="font-semibold">✓ {s.progress.pct}% off unlocked on every order</p>
              {s.progress.rebate.pending > 0 && <p className="mt-1 text-sm">${s.progress.rebate.pending.toFixed(2)} rebate comes off your next delivery.</p>}
            </>
          ) : (
            <>
              <p className="font-semibold">{s.progress.done} of {s.progress.need} deliveries done</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full bg-[#d13f74]" style={{ width: `${Math.min(100, (s.progress.done / Math.max(1, s.progress.need)) * 100)}%` }} /></div>
              <p className="mt-2 text-sm text-muted">After {s.progress.need} delivered orders you unlock {s.progress.pct}% off every order{s.progress.noRebate ? "" : `, plus ${s.progress.pct}% back on the orders you've already received`}. Skipped months don't count; cancelling before then loses the rebate. <a href="/pages/subscription-terms/" className="underline">Terms</a></p>
            </>
          )}
        </div>
      )}
      <p className="mt-6 text-sm text-muted">Orders are placed automatically and paid on delivery to {s.city}. We'll message you on WhatsApp 3 days before each one. {s.orders} order{s.orders === 1 ? "" : "s"} so far.</p>
      <Link href="/shop/" className="mt-6 inline-block font-semibold underline">Keep shopping</Link>
    </div>
  );
}
