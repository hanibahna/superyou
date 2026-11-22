"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type V = { id: string; status: "active" | "paused" | "cancelled"; every: 1 | 3; items: { productId: string; qty: number; name: string }[]; nextAt: string; orders: number; name: string; city: string };
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
          <div className="mt-5 grid grid-cols-2 gap-2">
            {([1, 3] as const).map((e) => (
              <button key={e} disabled={busy} onClick={() => act({ action: "every", every: e })} className={`min-h-[48px] rounded-2xl text-sm font-semibold ${s.every === e ? "bg-ink text-white" : "bg-white"}`}>{e === 1 ? "Every month" : "Every 3 months"}</button>
            ))}
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
      <p className="mt-6 text-sm text-muted">Orders are placed automatically and paid on delivery to {s.city}. We'll message you on WhatsApp 3 days before each one. {s.orders} order{s.orders === 1 ? "" : "s"} so far.</p>
      <Link href="/shop/" className="mt-6 inline-block font-semibold underline">Keep shopping</Link>
    </div>
  );
}
