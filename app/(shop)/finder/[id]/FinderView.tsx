"use client";

import { ShareButton } from "@/components/ShareButton";
import Link from "next/link";
import { useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import type { Finder } from "@/lib/finders";
import { useT } from "@/lib/site-context";

type Card = Parameters<typeof ProductCard>[0]["product"];

export function FinderView({ finder: f, others }: { finder: Finder; others: { id: string; title: string }[] }) {
  const tx = useT();
  const [answers, setAnswers] = useState<number[]>([]);
  const [products, setProducts] = useState<Card[] | null>(null);
  const [exact, setExact] = useState(true);
  const [busy, setBusy] = useState(false);
  const step = answers.length;
  const done = step >= f.questions.length;

  const pick = async (i: number) => {
    const next = [...answers, i];
    setAnswers(next);
    if (next.length < f.questions.length) return;
    setBusy(true);
    const r = await fetch("/api/finder/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: f.id, answers: next }) });
    const d = await r.json().catch(() => ({ products: [] }));
    setProducts(d.products ?? []);
    setExact(d.exact !== false);
    setBusy(false);
  };
  const restart = () => (setAnswers([]), setProducts(null));

  return (
    <div className="container-x py-8 md:py-12">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{tx("SuperYou apps")}</p>
        <h1 className="mt-2 text-4xl font-bold md:text-5xl">{tx(f.title)}</h1>
        <p className="mt-3 text-muted">{tx(f.intro)}</p>
      </div>

      {!done && (
        <div className="mx-auto mt-8 max-w-2xl rounded-3xl bg-[#f6f1f3] p-6 md:p-10">
          <div className="mb-5 flex gap-1.5" aria-hidden>{f.questions.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-ink" : "bg-white"}`} />)}</div>
          <p className="text-sm text-muted">{tx("Question")} {step + 1} / {f.questions.length}</p>
          <h2 className="mt-1 text-2xl font-bold">{tx(f.questions[step].q)}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {f.questions[step].options.map((o, i) => (
              <button key={o.label} onClick={() => pick(i)} className="min-h-[56px] rounded-2xl border-2 border-transparent bg-white px-5 text-start font-semibold transition hover:border-ink">{tx(o.label)}</button>
            ))}
          </div>
          {step > 0 && <button onClick={() => setAnswers(answers.slice(0, -1))} className="mt-5 text-sm font-semibold underline">{tx("Back")}</button>}
        </div>
      )}

      {done && (
        <div className="mt-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">{busy ? tx("Finding your matches…") : exact ? tx("Your matches") : tx("Popular in this section")}</h2>
            <div className="flex gap-2">
              <ShareButton title={`${f.title} – SuperYou`} />
              <button onClick={restart} className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold">{tx("Start again")}</button>
              <button onClick={() => window.dispatchEvent(new Event("open-advisor"))} className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white">{tx("Ask AI about these")}</button>
            </div>
          </div>
          {busy ? (
            <div className="pgrid grid grid-cols-2 gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton aspect-[3/4] rounded-2xl" />)}</div>
          ) : products && products.length ? (
            <div className="pgrid grid grid-cols-2 gap-4 md:grid-cols-4">{products.map((p) => <ProductCard key={p.slug} product={p} />)}</div>
          ) : (
            <p className="text-muted">{tx("Nothing matched. Try different answers or ask our pharmacist.")}</p>
          )}
          {f.note && <p className="mt-6 rounded-2xl bg-brand-50 p-4 text-sm">{tx(f.note)} <Link href="/services/" className="font-semibold underline">{tx("Book a free video call")}</Link></p>}
        </div>
      )}

      <div className="mt-12 border-t border-line pt-8">
        <p className="mb-3 font-semibold">{tx("More SuperYou apps")}</p>
        <div className="flex flex-wrap gap-2">
          {[{ id: "", title: "Routine finder", href: "/routine/" }, { id: "", title: "Shade finder", href: "/shade-finder/" }, { id: "", title: "SuperScan", href: "/skin-scan/" }, ...others.map((o) => ({ ...o, href: `/finder/${o.id}/` }))].map((o) => (
            <Link key={o.href} href={o.href} className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold hover:border-ink">{tx(o.title)}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}
