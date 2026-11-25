"use client";

import { useState } from "react";
import type { Order } from "@/lib/orders";

const when = (s?: string) => (s ? new Date(s).toLocaleString("en-GB", { timeZone: "Asia/Beirut", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

/** Order page: where the parcel is (supplier → courier → customer), the delivery photo, and manual controls. */
export function FulfilAdmin({ id, fulfil, links }: { id: string; fulfil?: Order["fulfil"]; links: { s: string; c: string } }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (action: string) => {
    setBusy(true);
    const r = await fetch(`/api/admin/fulfil/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    setMsg(r?.ok ? "Done — reload to see it" : d.error ?? "Failed");
  };
  const steps: [string, string | undefined][] = [["Sent to supplier", fulfil?.sentAt], ["Ready for pickup", fulfil?.readyAt], ["Picked up", fulfil?.pickedAt], ["Delivered", fulfil?.deliveredAt]];
  const b = "rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-[#f6f1f3] disabled:opacity-50";
  return (
    <div className="rounded-xl bg-white p-5 text-sm shadow-sm">
      <h2 className="mb-2 font-semibold">Supplier → courier → customer</h2>
      <ol className="space-y-1">
        {steps.map(([l, at]) => <li key={l} className={at ? "text-[#046c4e]" : "text-muted"}>{at ? "✓" : "○"} {l} {at && <span className="text-xs">· {when(at)}</span>}</li>)}
      </ol>
      {fulfil?.pod && (
        <a href={fulfil.pod} target="_blank" rel="noreferrer" className="mt-2 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fulfil.pod} alt="Proof of delivery" className="max-h-48 rounded-lg" />
          <span className="text-xs text-muted">Proof of delivery ({fulfil.podFrom})</span>
        </a>
      )}
      {fulfil?.payable !== undefined && <p className="mt-2">Due to supplier: <b>${fulfil.payable.toFixed(2)}</b> {fulfil.paidAt ? <span className="text-[#046c4e]">· paid {when(fulfil.paidAt)}</span> : <span className="text-sale">· not paid</span>}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => act("send")} className={b}>{fulfil ? "Resend to supplier" : "Send to supplier"}</button>
        {fulfil && !fulfil.readyAt && <button disabled={busy} onClick={() => act("ready")} className={b}>Mark ready (tell courier)</button>}
        {fulfil?.readyAt && !fulfil.pickedAt && <button disabled={busy} onClick={() => act("picked")} className={b}>Mark picked up</button>}
        <a href={links.s} target="_blank" rel="noreferrer" className={b}>Supplier page / label ↗</a>
        <a href={links.c} target="_blank" rel="noreferrer" className={b}>Courier page ↗</a>
      </div>
      {msg && <p className="mt-2 text-xs">{msg}</p>}
    </div>
  );
}
