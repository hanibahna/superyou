"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/site-context";
import { money } from "@/lib/format";

export type ClinicItem = { id: string; name: string; category: string; what: string; routine: string; sessions: string; downtime: string; minutes: number; priceFrom: number };

export function ClinicView({ partner, mock, note, items }: { partner: string; mock: boolean; note: string; items: ClinicItem[] }) {
  const t = useT();
  const [book, setBook] = useState<ClinicItem | null>(null);
  const cats = useMemo(() => Array.from(new Set(items.map((i) => i.category))), [items]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("book");
    if (id) setBook(items.find((i) => i.id === id) ?? null);
  }, [items]);
  return (
    <div className="container-x max-w-5xl py-10">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-600">{t("With our partner dermatologist")}</p>
      <h1 className="mt-1 text-4xl font-black">{t("Clinic treatments")}</h1>
      <p className="mt-3 max-w-2xl text-muted">{t("Your home routine prepares and maintains your skin; clinic treatments do what creams can't. Start with a dermatologist consultation, then follow the plan. Book here, and we confirm your date on WhatsApp.")}</p>
      <p className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-full bg-[#f6f1f3] px-4 py-2 text-sm">
        <b>{partner}</b>{mock && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold uppercase">{t("Mock-up")}</span>}<span className="text-muted">{t("Partner clinic, Beirut")}</span>
      </p>

      <ol className="mt-8 grid gap-3 sm:grid-cols-3">
        {[t("1. Dermatologist consultation: your skin checked and a plan"), t("2. Treatments in the order your doctor sets"), t("3. Your SuperYou routine at home keeps the results")].map((x) => (
          <li key={x} className="rounded-2xl border border-line p-4 text-sm font-semibold">{x}</li>
        ))}
      </ol>

      {cats.map((c) => (
        <section key={c} className="mt-10">
          <h2 className="text-xl font-bold">{t(c)}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {items.filter((i) => i.category === c).map((i) => (
              <article key={i.id} className="flex flex-col rounded-2xl border border-line p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold">{t(i.name)}</h3>
                  <span className="shrink-0 text-sm"><span className="text-muted">{t("from")}</span> <b>{money(i.priceFrom)}</b></span>
                </div>
                <p className="mt-1 text-sm">{t(i.what)}</p>
                <p className="mt-3 rounded-xl bg-[#f6f1f3] p-3 text-[13px]"><b>{t("With your routine:")}</b> {t(i.routine)}</p>
                <p className="mt-3 text-xs text-muted">{t("Sessions")}: {t(i.sessions)} · {t("Downtime")}: {t(i.downtime)} · {i.minutes} min</p>
                <button onClick={() => setBook(i)} className="mt-4 min-h-[44px] self-start rounded-full bg-ink px-5 text-sm font-semibold text-white">{t("Book")}</button>
              </article>
            ))}
          </div>
        </section>
      ))}
      <p className="mt-10 text-xs text-muted">{note} {t("Treatments are performed by the partner clinic's doctors, who decide if a treatment suits you.")}</p>
      {book && <BookTreatment item={book} partner={partner} onClose={() => setBook(null)} />}
    </div>
  );
}

/** A booking request: preferred date + contact; our team confirms the date on WhatsApp. */
export function BookTreatment({ item, partner, onClose }: { item: ClinicItem; partner: string; onClose: () => void }) {
  const t = useT();
  const [f, setF] = useState({ name: "", phone: "", date: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const min = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const send = async () => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/bookings/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "clinic", refId: item.id, date: f.date, name: f.name, phone: f.phone, notes: f.notes }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.ok) setDone(true); else setMsg(d.error ?? t("Please try again"));
  };
  const box = "min-h-[48px] w-full rounded-xl border border-line px-3 text-base outline-none focus:border-ink md:text-sm";
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={t("Book a treatment")} onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs text-muted">{partner}</p><h2 className="text-xl font-bold">{t(item.name)}</h2><p className="text-sm">{t("from")} <b>{money(item.priceFrom)}</b></p></div>
          <button onClick={onClose} aria-label={t("Close")} className="grid h-10 w-10 place-items-center rounded-full bg-[#f6f1f3]">✕</button>
        </div>
        {done ? (
          <p className="mt-5 rounded-2xl bg-green-50 p-4 text-sm">{t("Request received ✓ Our team will message you on WhatsApp to confirm the date and time. Nothing to pay now.")}</p>
        ) : (
          <div className="mt-5 grid gap-2">
            <input aria-label={t("Your name")} placeholder={t("Your name")} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={box} />
            <input aria-label={t("WhatsApp number")} inputMode="tel" placeholder={t("WhatsApp number")} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={box} />
            <label className="text-xs text-muted">{t("Preferred date")}<input type="date" min={min} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={box} /></label>
            <textarea aria-label={t("Notes (optional)")} placeholder={t("Notes (optional): preferred time, questions")} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="min-h-[80px] w-full rounded-xl border border-line p-3 text-base outline-none focus:border-ink md:text-sm" />
            {msg && <p className="text-sm text-sale">{msg}</p>}
            <button onClick={send} disabled={busy || f.name.length < 2 || f.phone.length < 6 || !f.date} className="min-h-[48px] rounded-full bg-ink font-semibold text-white disabled:opacity-40">{busy ? t("Sending…") : t("Request this date")}</button>
            <p className="text-[11px] text-muted">{t("Your date is confirmed by our team on WhatsApp. Prices are indicative and confirmed by the clinic after your consultation.")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
