"use client";

import { useT } from "@/lib/site-context";

import Link from "next/link";
import { useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { money } from "@/lib/format";
import type { CardItem } from "@/lib/listing";
import type { RoutineAnswers } from "@/lib/routine";
import { useShop } from "@/lib/store";

type Step = { id: string; name: string; time: "am" | "pm" | "both"; tip: string; picks: CardItem[] };

export function RoutineWizard({ title, intro, skinTypes, concerns, goals, labels = {} }: { title: string; intro: string; skinTypes: { id: string; label: string; hint: string }[]; concerns: string[]; goals: string[]; labels?: Record<string, string> }) {
  const tx = useT();
  const { addMany } = useShop();
  const [n, setN] = useState(0);
  const [a, setA] = useState<RoutineAnswers>({ skinType: "", concerns: [], goals: [], sensitive: false, budget: "any", length: "full" });
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const toggle = (k: "concerns" | "goals", v: string, max = 3) =>
    setA((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v].slice(-max) }));

  async function build() {
    setBusy(true);
    const res = await fetch("/api/routine/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) });
    const data = await res.json();
    setSteps(data.steps ?? []);
    setChosen({});
    setBusy(false);
    setN(5);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const questions = [
    {
      q: tx("What's your skin type?"),
      ok: !!a.skinType,
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          {skinTypes.map((t) => (
            <Choice key={t.id} on={a.skinType === t.id} onClick={() => setA({ ...a, skinType: t.id })} label={t.label} hint={t.hint} />
          ))}
        </div>
      ),
    },
    {
      q: "What would you like to work on?",
      sub: tx("Pick up to 3"),
      ok: a.concerns.length > 0,
      body: <div className="grid gap-3 sm:grid-cols-2">{concerns.map((c) => <Choice key={c} on={a.concerns.includes(c)} onClick={() => toggle("concerns", c)} label={labels[c] ?? c} />)}</div>,
    },
    {
      q: "What results are you hoping for?",
      sub: "Optional · pick up to 2",
      ok: true,
      body: <div className="grid gap-3 sm:grid-cols-2">{goals.map((g) => <Choice key={g} on={a.goals.includes(g)} onClick={() => toggle("goals", g, 2)} label={labels[g] ?? g} />)}</div>,
    },
    {
      q: tx("Does your skin react easily?"),
      ok: true,
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice on={a.sensitive} onClick={() => setA({ ...a, sensitive: true })} label="Yes, it's reactive" hint={tx("We'll favour gentle, fragrance-free formulas")} />
          <Choice on={!a.sensitive} onClick={() => setA({ ...a, sensitive: false })} label="No, it's fine" />
        </div>
      ),
    },
    {
      q: "Budget and routine size",
      ok: true,
      body: (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            {([["any", "Any budget"], ["low", "Under $20 each"], ["mid", "$15–45 each"], ["high", "Premium"]] as const).map(([k, l]) => (
              <Choice key={k} on={a.budget === k} onClick={() => setA({ ...a, budget: k })} label={l} />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice on={a.length === "essential"} onClick={() => setA({ ...a, length: "essential" })} label={tx("Essentials (3 steps)")} hint="Cleanser, moisturiser, sunscreen" />
            <Choice on={a.length === "full"} onClick={() => setA({ ...a, length: "full" })} label={tx("Complete routine")} hint="Adds serum, eye care, toner and night treatment" />
          </div>
        </div>
      ),
    },
  ];

  if (n === 5 && steps) {
    const picked = steps.map((s) => s.picks[chosen[s.id] ?? 0]).filter((p): p is CardItem => !!p);
    const total = picked.reduce((s, p) => s + p.price, 0);
    const am = steps.filter((s) => s.time !== "pm");
    const pm = steps.filter((s) => s.time !== "am");
    return (
      <div className="container-x max-w-5xl py-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Your routine</p>
        <h1 className="mt-1 text-3xl font-semibold">Here's what we recommend</h1>
        <p className="mt-2 text-muted">{tx("Tap an alternative to swap a product. Introduce new actives one at a time and patch-test first. Ask our pharmacists on WhatsApp if unsure.")}</p>
        {[["☀️ Morning", am], ["🌙 Evening", pm]].map(([label, list]) => (
          <section key={label as string} className="mt-8">
            <h2 className="mb-3 text-xl font-semibold">{label as string}</h2>
            <ol className="space-y-3">
              {(list as Step[]).map((s, i) => {
                const p = s.picks[chosen[s.id] ?? 0];
                return (
                  <li key={s.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-start gap-4">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-500 text-sm font-bold text-white">{i + 1}</span>
                      <div className="min-w-48 flex-1">
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-xs text-muted">{s.tip}</p>
                      </div>
                      {p ? (
                        <Link href={`/products/${p.slug}/`} className="flex min-w-64 flex-1 items-center gap-3 rounded-lg bg-brand-50 p-2">
                          <ProductImage product={p} width={120} className="h-16 w-16 rounded" />
                          <span className="flex-1 text-sm leading-snug"><span className="block text-xs font-semibold uppercase text-muted">{p.brand}</span>{p.name}</span>
                          <span className="font-semibold">{money(p.price)}</span>
                        </Link>
                      ) : <p className="text-sm text-muted">{tx("No match in stock right now.")}</p>}
                    </div>
                    {s.picks.length > 1 && (
                      <div className="ml-12 mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="self-center text-muted">Alternatives:</span>
                        {s.picks.map((x, k) => (
                          <button key={x.slug} onClick={() => setChosen({ ...chosen, [s.id]: k })} className={`rounded-full border px-3 py-1 ${k === (chosen[s.id] ?? 0) ? "border-brand-500 bg-brand-50 font-semibold" : "border-line"}`}>
                            {x.brand} · {money(x.price)}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
        <div className="sticky bottom-4 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink p-5 text-white shadow-xl">
          <p><span className="text-sm opacity-70">{picked.length} products · </span><b className="text-lg">{money(total)}</b></p>
          <div className="flex gap-2">
            <button onClick={() => setN(0)} className="rounded-lg border border-white/30 px-4 py-2.5 text-sm">Start over</button>
            <button onClick={() => addMany(picked)} disabled={!picked.length} className="rounded-lg bg-brand-500 px-5 py-2.5 font-semibold hover:bg-brand-600">{tx("Add full routine to cart")}</button>
          </div>
        </div>
      </div>
    );
  }

  const cur = questions[n];
  return (
    <div className="container-x max-w-3xl py-10">
      {n === 0 && (
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-muted">{intro}</p>
        </div>
      )}
      <div className="mb-6 flex gap-1.5">{questions.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= n ? "bg-brand-500" : "bg-line"}`} />)}</div>
      <p className="text-sm text-muted">Question {n + 1} of {questions.length}</p>
      <h2 className="mt-1 text-2xl font-semibold">{cur.q}</h2>
      {"sub" in cur && cur.sub && <p className="text-sm text-muted">{cur.sub}</p>}
      <div className="mt-5">{cur.body}</div>
      <div className="mt-8 flex justify-between">
        <button onClick={() => setN(Math.max(0, n - 1))} disabled={n === 0} className="rounded-lg border border-line px-5 py-2.5 text-sm disabled:opacity-30">{tx("Back")}</button>
        {n < questions.length - 1 ? (
          <button onClick={() => setN(n + 1)} disabled={!cur.ok} className="rounded-lg bg-brand-500 px-6 py-2.5 font-semibold text-white disabled:opacity-40">{tx("Next")}</button>
        ) : (
          <button onClick={build} disabled={busy} className="rounded-lg bg-brand-500 px-6 py-2.5 font-semibold text-white disabled:opacity-60">{busy ? "Building…" : tx("Build my routine")}</button>
        )}
      </div>
    </div>
  );
}

function Choice({ on, onClick, label, hint }: { on: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button onClick={onClick} className={`rounded-xl border p-4 text-left transition ${on ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-line hover:border-brand-500"}`}>
      <span className="block font-semibold">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
    </button>
  );
}
