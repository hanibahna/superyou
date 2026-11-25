"use client";

import { useState } from "react";
import { useT } from "@/lib/site-context";

const TYPES = ["Pharmacy", "Beauty salon / spa", "Clinic / dermatologist", "Gym / sports club", "Hotel", "Online shop / reseller", "Corporate gifts", "Other"];
const CATS = ["Skin care", "Make up", "Hair", "Fragrance", "Body & baby", "Parapharmacy", "Supplements", "Sports nutrition"];

export function WholesaleForm() {
  const t = useT();
  const [f, setF] = useState({ business: "", type: "", contact: "", phone: "", email: "", city: "", volume: "", brands: "", message: "" });
  const [cats, setCats] = useState<string[]>([]);
  const [state, setState] = useState<"" | "busy" | "done">("");
  const [err, setErr] = useState("");
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy"); setErr("");
    const r = await fetch("/api/wholesale/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, categories: cats }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setState(""); return setErr(d.error ?? t("Something went wrong, please try again")); }
    setState("done");
  };
  if (state === "done") return <p className="sp-in mt-6 rounded-2xl bg-[#ecfdf3] p-5 font-semibold text-[#046c4e]">✓ {t("Thank you! Our team will contact you within one working day.")}</p>;
  const input = "tap w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus:border-ink";
  return (
    <form onSubmit={send} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-medium">{t("Business name")} *<input required value={f.business} onChange={up("business")} className={input} /></label>
      <label className="grid gap-1 text-sm font-medium">{t("Type of business")}<select value={f.type} onChange={up("type")} className={input}><option value="">{t("Choose")}</option>{TYPES.map((x) => <option key={x}>{x}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-medium">{t("Your name")} *<input required value={f.contact} onChange={up("contact")} autoComplete="name" className={input} /></label>
      <label className="grid gap-1 text-sm font-medium">{t("Mobile / WhatsApp")} *<input required type="tel" value={f.phone} onChange={up("phone")} autoComplete="tel" placeholder="70 123 456" className={input} /></label>
      <label className="grid gap-1 text-sm font-medium">{t("Email")}<input type="email" value={f.email} onChange={up("email")} autoComplete="email" className={input} /></label>
      <label className="grid gap-1 text-sm font-medium">{t("City / area")}<input value={f.city} onChange={up("city")} className={input} /></label>
      <label className="grid gap-1 text-sm font-medium">{t("Expected monthly volume")}<select value={f.volume} onChange={up("volume")} className={input}><option value="">{t("Choose")}</option>{["Under $500", "$500 – $2,000", "$2,000 – $10,000", "Over $10,000"].map((x) => <option key={x}>{x}</option>)}</select></label>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium">{t("What do you need?")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATS.map((c) => {
            const on = cats.includes(c);
            return <button key={c} type="button" aria-pressed={on} onClick={() => setCats((x) => (on ? x.filter((y) => y !== c) : [...x, c]))} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>{t(c)}</button>;
          })}
        </div>
      </fieldset>
      <label className="grid gap-1 text-sm font-medium sm:col-span-2">{t("Brands you're interested in")}<input value={f.brands} onChange={up("brands")} placeholder="La Roche-Posay, Bioderma, Vichy…" className={input} /></label>
      <label className="grid gap-1 text-sm font-medium sm:col-span-2">{t("Message")}<textarea rows={4} value={f.message} onChange={up("message")} className={input} /></label>
      {err && <p className="text-sm text-sale sm:col-span-2">{err}</p>}
      <button disabled={state === "busy"} className="tap rounded-full bg-ink py-3.5 font-semibold text-white disabled:opacity-60 sm:col-span-2">{state === "busy" ? "…" : t("Send my request")}</button>
    </form>
  );
}
