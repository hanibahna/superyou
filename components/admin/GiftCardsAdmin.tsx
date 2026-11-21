"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { money } from "@/lib/format";
import { normPhone } from "@/lib/wa";

type Card = { code: string; initial: number; balance: number; createdAt: string; expiresAt?: string; recipient: string; phone: string; note: string; disabled: boolean; by: string; history: { at: string; amount: number; orderId?: string; note?: string }[] };
const input = "w-full rounded-lg border border-line px-3 py-2 text-sm";

export function GiftCardsAdmin({ cards, validMonths }: { cards: Card[]; validMonths: number }) {
  const router = useRouter();
  const [f, setF] = useState({ amount: "50", recipient: "", phone: "", note: "", count: "1" });
  const [made, setMade] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  async function post(body: unknown) {
    setMsg("");
    const res = await fetch("/api/admin/giftcards/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(data.error ?? "Could not save");
    else router.refresh();
    return res.ok ? data : null;
  }

  const shown = cards.filter((c) => !q || `${c.code} ${c.recipient} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  const outstanding = cards.filter((c) => !c.disabled).reduce((s, c) => s + c.balance, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Gift cards</h1>
        <p className="text-sm text-muted">Customers type the code (GC-…) in the discount box at checkout; it works like money and can be used over several orders. {cards.length} cards · {money(outstanding)} still to be spent.</p>
      </div>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Create gift cards</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <label className="text-sm"><span className="mb-1 block font-medium">Amount ($)</span><input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} className={input} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">For (name)</span><input value={f.recipient} onChange={(e) => setF({ ...f, recipient: e.target.value })} className={input} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Mobile</span><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Note</span><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. sold in store, influencer" className={input} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">How many</span><input inputMode="numeric" value={f.count} onChange={(e) => setF({ ...f, count: e.target.value.replace(/\D/g, "") })} className={input} /></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={async () => {
              const d = await post({ action: "issue", amount: Number(f.amount), recipient: f.recipient, phone: f.phone, note: f.note, count: Math.max(1, Number(f.count) || 1) });
              if (d) setMade(d.codes);
            }}
            disabled={!(Number(f.amount) > 0)}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >Create</button>
          <span className="text-xs text-muted">{validMonths ? `Valid ${validMonths} months` : "No expiry"} (change in Operations).</span>
          {msg && <span className="text-sm text-sale">{msg}</span>}
        </div>
        {made.length > 0 && (
          <div className="mt-3 rounded-lg bg-brand-50 p-3 text-sm">
            <p className="font-semibold">New code{made.length > 1 ? "s" : ""}:</p>
            <p className="mt-1 select-all font-mono">{made.join("  ")}</p>
            {made.length === 1 && f.phone && normPhone(f.phone) && (
              <a target="_blank" href={`https://wa.me/${normPhone(f.phone)}?text=${encodeURIComponent(`Hi ${f.recipient.split(" ")[0] || ""}! Here is your SuperYou gift card worth $${Number(f.amount).toFixed(2)}: ${made[0]}. Use it at checkout on shopsuperyou.com`)}`} className="mt-2 inline-block font-semibold text-brand-700 underline">Send it on WhatsApp ↗</a>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-line p-3">
          <h2 className="font-semibold">All gift cards</h2>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, name, mobile" className="w-60 rounded-lg border border-line px-3 py-1.5 text-sm" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="p-3">Code</th><th className="p-3">For</th><th className="p-3">Created</th><th className="p-3">Expires</th><th className="p-3 text-right">Value</th><th className="p-3 text-right">Balance</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-line">
              {shown.map((c) => (
                <Fragment key={c.code}>
                  <tr className={c.disabled ? "opacity-50" : ""}>
                    <td className="p-3 font-mono">{c.code}{c.disabled && <span className="ms-1 text-xs text-sale">cancelled</span>}</td>
                    <td className="p-3">{c.recipient || "—"}<span className="block text-xs text-muted">{c.phone}{c.note ? ` · ${c.note}` : ""}</span></td>
                    <td className="p-3 text-muted">{new Date(c.createdAt).toLocaleDateString("en-GB")}</td>
                    <td className="p-3 text-muted">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-GB") : "—"}</td>
                    <td className="p-3 text-right">{money(c.initial)}</td>
                    <td className="p-3 text-right font-semibold">{money(c.balance)}</td>
                    <td className="p-3 text-right"><button onClick={() => setOpen(open === c.code ? null : c.code)} className="text-brand-700 underline">{open === c.code ? "Close" : "Manage"}</button></td>
                  </tr>
                  {open === c.code && (
                    <tr>
                      <td colSpan={7} className="bg-[#fafbfa] p-4">
                        <CardManage card={c} post={post} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {!shown.length && <tr><td colSpan={7} className="p-10 text-center text-muted">No gift cards yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CardManage({ card, post }: { card: Card; post: (b: unknown) => Promise<unknown> }) {
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">History</p>
        <ul className="space-y-1 text-sm">
          {[...card.history].reverse().map((h, i) => (
            <li key={i} className="flex justify-between gap-2"><span>{new Date(h.at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Beirut" })} · {h.orderId ? `Order ${h.orderId}` : h.note}</span><span className={h.amount < 0 ? "text-sale" : "text-brand-600"}>{h.amount > 0 ? "+" : "−"}{money(Math.abs(h.amount))}</span></li>
          ))}
        </ul>
      </div>
      <div className="space-y-2 text-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Change the balance</p>
        <div className="flex gap-2">
          <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.-]/g, ""))} placeholder="+20 or -15" className="w-28 rounded-lg border border-line px-3 py-2" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why (e.g. used in store)" className="flex-1 rounded-lg border border-line px-3 py-2" />
          <button onClick={() => post({ action: "adjust", code: card.code, amount: Number(amt), note })} disabled={!Number(amt)} className="rounded-lg bg-brand-500 px-3 font-semibold text-white disabled:opacity-50">Apply</button>
        </div>
        <button onClick={() => post({ action: "disable", code: card.code, disabled: !card.disabled })} className="text-sale underline">{card.disabled ? "Re-activate this card" : "Cancel this card"}</button>
      </div>
    </div>
  );
}
