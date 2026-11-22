"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import { useT } from "@/lib/site-context";

type Method = { id: "cod" | "card" | "whish"; label: string; description: string };
const input = "w-full rounded-lg border border-line px-4 py-3 text-sm outline-none focus:border-brand-500";

export function GiftCardBuy({ amounts, methods, enabled, validMonths }: { amounts: number[]; methods: Method[]; enabled: boolean; validMonths: number }) {
  const tx = useT();
  const [amount, setAmount] = useState(amounts[1] ?? 50);
  const [custom, setCustom] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [method, setMethod] = useState<Method["id"]>(methods.find((m) => m.id === "card")?.id ?? methods[0]?.id ?? "cod");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const value = custom ? Number(custom) : amount;

  if (!enabled)
    return <div className="container-x py-24 text-center"><h1 className="text-3xl font-semibold">{tx("Gift cards")}</h1><p className="mt-3 text-muted">{tx("Gift cards aren't available right now.")}</p></div>;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const res = await fetch("/api/giftcards/buy/", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: value, recipient, phone: f.rPhone, email: f.rEmail, message,
        buyer: { firstName: f.firstName, lastName: f.lastName, phone: f.phone, email: f.email }, paymentMethod: method,
      }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : { error: "Network error" };
    if (res?.ok) window.location.href = data.next.redirect;
    else (setError(data.error ?? "Something went wrong."), setBusy(false));
  }

  return (
    <div className="container-x py-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_440px]">
        <form onSubmit={submit} className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold">{tx("Gift cards")}</h1>
            <p className="mt-2 text-muted">{tx("Let them choose. Sent by WhatsApp or email, used like money at checkout, over as many orders as they like.")}</p>
          </div>

          <fieldset>
            <legend className="mb-3 text-lg font-semibold">{tx("1. Amount")}</legend>
            <div className="flex flex-wrap gap-2">
              {amounts.map((a) => (
                <button type="button" key={a} onClick={() => (setAmount(a), setCustom(""))} className={`rounded-full border px-5 py-2.5 text-sm font-semibold ${!custom && amount === a ? "border-ink bg-ink text-white" : "border-line"}`}>${a}</button>
              ))}
              <label className="flex items-center gap-2 rounded-full border border-line px-4 text-sm">
                {tx("Other")} $
                <input inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="10–1000" aria-label="Other amount" className="w-20 py-2.5 outline-none" />
              </label>
            </div>
            {custom && (value < 10 || value > 1000) && <p className="mt-2 text-xs text-sale">{tx("Choose between $10 and $1,000.")}</p>}
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-lg font-semibold">{tx("2. Who is it for?")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={recipient} onChange={(e) => setRecipient(e.target.value)} required placeholder={tx("Their name")} className={`${input} sm:col-span-2`} />
              <input name="rPhone" type="tel" placeholder={tx("Their mobile (we send it on WhatsApp)")} aria-label={tx("Their mobile (we send it on WhatsApp)")} className={input} />
              <input name="rEmail" type="email" placeholder={tx("…or their email")} aria-label={tx("…or their email")} className={input} />
              <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 300))} rows={3} placeholder={tx("Your message (optional)")} className={`${input} sm:col-span-2`} />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-lg font-semibold">{tx("3. From")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="firstName" required placeholder={tx("First name")} aria-label={tx("First name")} autoComplete="given-name" className={input} />
              <input name="lastName" required placeholder={tx("Last name")} aria-label={tx("Last name")} autoComplete="family-name" className={input} />
              <input name="phone" required type="tel" placeholder={tx("Your mobile")} aria-label={tx("Your mobile")} autoComplete="tel" className={input} />
              <input name="email" type="email" placeholder={tx("Your email (optional, for the receipt)")} aria-label={tx("Your email (optional, for the receipt)")} autoComplete="email" className={input} />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-lg font-semibold">{tx("4. Payment")}</legend>
            <div className="space-y-3">
              {methods.map((m) => (
                <label key={m.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${method === m.id ? "border-brand-500 bg-brand-50" : "border-line"}`}>
                  <input type="radio" name="method" checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-1 accent-[var(--color-brand-500)]" />
                  <span>
                    <span className="block font-semibold">{m.label}</span>
                    <span className="block text-sm text-muted">{m.id === "cod" ? tx("We collect the cash, then send the card.") : m.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && <p className="rounded-lg bg-sale/10 p-3 text-sm text-sale">{error}</p>}
          <button disabled={busy || !recipient || !(value >= 10 && value <= 1000)} className="w-full rounded-lg bg-brand-500 py-3.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-50 sm:w-auto sm:px-10">
            {busy ? tx("Please wait…") : `${tx("Buy gift card")} · ${money(value || 0)}`}
          </button>
          <p className="text-xs text-muted">{tx("The card is sent as soon as the payment is confirmed.")}{validMonths ? ` ${tx("Valid for")} ${validMonths} ${tx("months")}.` : ""}</p>
        </form>

        <aside className="lg:sticky lg:top-32 lg:h-fit">
          <div className="relative aspect-[1.6] overflow-hidden rounded-2xl bg-ink p-7 text-white shadow-xl" aria-label="Gift card preview">
            <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-sale/40 blur-3xl" aria-hidden="true" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-start justify-between">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/superyou-logo-white.svg" alt="SuperYou" className="h-4 w-auto" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">{tx("Gift card")}</span>
              </div>
              <div>
                <p className="text-5xl font-black text-sale">{money(value || 0)}</p>
                <p className="mt-2 text-sm text-white/80">{recipient ? `${tx("For")} ${recipient}` : tx("For someone special")}</p>
                {message && <p className="mt-1 line-clamp-2 text-xs italic text-white/60">“{message}”</p>}
              </div>
            </div>
          </div>
          <ul className="mt-5 space-y-2 text-sm text-muted">
            <li>✓ {tx("Arrives on WhatsApp or by email, with a code")}</li>
            <li>✓ {tx("Works on everything in the shop, including sale items")}</li>
            <li>✓ {tx("Any balance left stays on the card for next time")}</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
