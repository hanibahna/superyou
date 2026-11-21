"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  id: string;
  couriers: { id: string; name: string }[];
  shipment?: { courier: string; tracking: string };
  lines: { productId: string; name: string; qty: number }[];
  maxRefund: number;
  hasGiftCard: boolean;
  paymentMethod: string;
  cardGateway?: string; // gateway that can refund this order automatically
};

const input = "w-full rounded-lg border border-line px-3 py-2 text-sm";

export function OrderActions({ id, couriers, shipment, lines, maxRefund, hasGiftCard, paymentMethod, cardGateway }: Props) {
  const router = useRouter();
  const [courier, setCourier] = useState(shipment?.courier ?? couriers[0]?.id ?? "");
  const [tracking, setTracking] = useState(shipment?.tracking ?? "");
  const [refundOpen, setRefundOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState(paymentMethod === "cod" ? "cash" : paymentMethod);
  const [restock, setRestock] = useState<Record<string, number>>({});
  const [toCard, setToCard] = useState(!!cardGateway);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(kind: string, url: string, method_: string, body: unknown) {
    setBusy(kind);
    setMsg(null);
    const res = await fetch(url, { method: method_, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    setMsg(res.ok ? { ok: true, text: "Saved ✓" } : { ok: false, text: data.error ?? "Could not save" });
    if (res.ok) router.refresh();
    return res.ok;
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Ship &amp; refund</h2>
        {msg && <span className={`text-sm ${msg.ok ? "text-brand-600" : "text-sale"}`}>{msg.text}</span>}
      </div>
      <div className="mt-3 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm"><span className="mb-1 block font-medium">Courier</span>
          <select value={courier} onChange={(e) => setCourier(e.target.value)} className={input}>{couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label className="text-sm"><span className="mb-1 block font-medium">Tracking number (optional)</span>
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} className={input} />
        </label>
        <button disabled={!!busy || !courier} onClick={() => call("ship", `/api/admin/orders/${id}/`, "PATCH", { ship: { courier, tracking } })} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy === "ship" ? "Saving…" : shipment ? "Update shipping" : "Mark as shipped"}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">Sets the order to Shipped and sends the &quot;on its way&quot; WhatsApp message (with the tracking link when the courier has one).</p>

      <div className="mt-5 border-t border-line pt-4">
        {!refundOpen ? (
          <button onClick={() => setRefundOpen(true)} disabled={maxRefund <= 0} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-40">{maxRefund <= 0 ? "Fully refunded" : "Refund…"}</button>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <label><span className="mb-1 block font-medium">Amount (up to ${maxRefund.toFixed(2)})</span>
                <div className="flex gap-1"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className={input} /><button type="button" onClick={() => setAmount(maxRefund.toFixed(2))} className="rounded-lg border border-line px-2 text-xs">All</button></div>
              </label>
              <label><span className="mb-1 block font-medium">Refunded as</span>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={input}>
                  <option value="cash">Cash</option><option value="card">Card</option><option value="whish">Whish</option>
                  <option value="giftcard">{hasGiftCard ? "Back to the gift card" : "Store credit (new gift card)"}</option><option value="other">Other</option>
                </select>
              </label>
              <label><span className="mb-1 block font-medium">Reason</span><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. damaged, wrong shade" className={input} /></label>
            </div>
            {method === "card" && (
              cardGateway ? (
                <label className="flex items-start gap-2 rounded-lg bg-brand-50 p-3">
                  <input type="checkbox" checked={toCard} onChange={(e) => setToCard(e.target.checked)} className="mt-0.5" />
                  <span><b>Send the money back to the customer&apos;s card through {cardGateway}</b><span className="block text-xs text-muted">Untick if you already refunded it in the {cardGateway} dashboard.</span></span>
                </label>
              ) : <p className="rounded-lg bg-amber-50 p-3 text-xs">This order wasn&apos;t paid through a connected card gateway, so make the refund in your bank or gateway dashboard; this only records it.</p>
            )}
            <div>
              <p className="mb-1 font-medium">Put items back in stock (only if they can be sold again)</p>
              <ul className="space-y-1">
                {lines.map((l) => (
                  <li key={l.productId} className="flex items-center justify-between gap-3">
                    <span className="truncate">{l.name}</span>
                    <select value={restock[l.productId] ?? 0} onChange={(e) => setRestock((r) => ({ ...r, [l.productId]: Number(e.target.value) }))} className="rounded border border-line px-2 py-1" aria-label={`Back in stock: ${l.name}`}>
                      {Array.from({ length: l.qty + 1 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                disabled={!!busy || !(Number(amount) > 0)}
                onClick={async () => {
                  const ok = await call("refund", `/api/admin/orders/${id}/refund/`, "POST", { amount: Number(amount), reason, method, toCard: method === "card" && toCard, restocked: Object.entries(restock).filter(([, q]) => q > 0).map(([productId, qty]) => ({ productId, qty })) });
                  if (ok) (setRefundOpen(false), setAmount(""), setReason(""), setRestock({}));
                }}
                className="rounded-lg bg-sale px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {busy === "refund" ? "Saving…" : `Record refund${amount ? ` of $${Number(amount).toFixed(2)}` : ""}`}
              </button>
              <button onClick={() => setRefundOpen(false)} className="rounded-lg border border-line px-4 py-2">Cancel</button>
            </div>
            <p className="text-xs text-muted">This records the refund and updates sales reports. Cash and Whish refunds you hand back yourself.</p>
          </div>
        )}
      </div>
    </section>
  );
}
