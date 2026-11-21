"use client";

import { useT } from "@/lib/site-context";

import { useState } from "react";

export function NewsletterForm({ dark = false }: { dark?: boolean }) {
  const tx = useT();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const phone = String(fd.get("phone") ?? "");
    setState("busy");
    const res = await fetch("/api/newsletter/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, phone: phone || undefined }) }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  }
  if (state === "done") return <p className={`mt-3 text-sm font-semibold ${dark ? "text-white" : "text-brand-700"}`}>{tx("Thanks! You're on the list.")}</p>;
  const box = `w-full rounded-lg px-3 py-2 text-sm outline-none ${dark ? "bg-white/10 placeholder:text-white/50" : "border border-line bg-white"}`;
  return (
    <form onSubmit={submit} className="mt-3 grid gap-2">
      <input name="email" type="email" placeholder="Your email" aria-label="Email" className={box} />
      <div className="flex gap-2">
        <input name="phone" inputMode="tel" placeholder="or WhatsApp number" aria-label="WhatsApp number" className={box} />
        <button disabled={state === "busy"} className="shrink-0 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white disabled:opacity-60">{tx("Join")}</button>
      </div>
      <p className={`text-[11px] ${dark ? "text-white/50" : "text-muted"}`}>{tx("Offers by email and/or WhatsApp. Unsubscribe anytime (reply STOP on WhatsApp).")}</p>
      {state === "error" && <span className="text-xs text-sale">Please enter a valid email or WhatsApp number</span>}
    </form>
  );
}
