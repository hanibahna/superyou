"use client";

import Link from "next/link";
import { useState } from "react";
import { useGrowth, useT } from "@/lib/site-context";
import { AddressBook } from "@/components/AddressBook";
import { localAddresses, saveLocalAddresses, type Address } from "@/lib/addresses";

export function JoinClub() {
  const tx = useT();
  const g = useGrowth();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const [addrOpen, setAddrOpen] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>(() => (typeof window === "undefined" ? [] : localAddresses()));
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setState("busy");
    const r = await fetch("/api/club/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, phone: f.phone, email: f.email, birthday: f.day && f.month ? `${f.month.padStart(2, "0")}-${f.day.padStart(2, "0")}` : "", addresses }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) return setState("idle"), setErr(d.error ?? "Please try again");
    saveLocalAddresses(addresses); // ready at checkout on this phone
    setState("done");
  }
  if (state === "done") return <p className="rounded-2xl bg-brand-50 p-6 text-center font-semibold">Welcome to {g.club.name}! Your points start with your next order. <Link href="/shop/" className="underline">{tx("Start shopping")}</Link></p>;
  const box = "tap w-full rounded-lg border border-line px-4 outline-none focus:border-ink";
  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="text-2xl font-semibold">{tx("Join free")}</h2>
      <input name="name" required placeholder={tx("Full name")} className={box} />
      <input name="phone" required inputMode="tel" placeholder="WhatsApp number" className={box} />
      <input name="email" type="email" placeholder="Email (optional)" className={box} />
      <div className="flex items-center gap-2 text-sm text-muted">
        Birthday:
        <select name="day" className="rounded-lg border border-line px-2 py-2" defaultValue=""><option value="">{tx("Day")}</option>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
        <select name="month" className="rounded-lg border border-line px-2 py-2" defaultValue=""><option value="">{tx("Month")}</option>{["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
      </div>
      <div className="rounded-2xl bg-[#faf7f8] p-4">
        <button type="button" onClick={() => setAddrOpen(!addrOpen)} className="flex w-full items-center justify-between text-left text-sm font-semibold">
          <span>📍 {tx("Delivery addresses")} {addresses.length ? `(${addresses.length})` : <span className="font-normal text-muted">({tx("optional")})</span>}</span>
          <span aria-hidden>{addrOpen ? "−" : "+"}</span>
        </button>
        {addrOpen && <div className="mt-3"><p className="mb-3 text-xs text-muted">{tx("Pin your home, work or family's door on the map. Checkout fills them in for you.")}</p><AddressBook addresses={addresses} onChange={setAddresses} /></div>}
      </div>
      {err && <p className="text-sm text-sale">{err}</p>}
      <button disabled={state === "busy"} className="tap w-full rounded-full bg-ink font-semibold text-white disabled:opacity-60">Join {g.club.name}</button>
      <p className="text-xs text-muted">{tx("We'll send your vouchers and member offers on WhatsApp. Reply STOP anytime. Already a member?")} <Link href="/account/" className="underline">See your points</Link>.</p>
    </form>
  );
}
