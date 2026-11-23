"use client";

import { useT } from "@/lib/site-context";

import Link from "next/link";
import { useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { money } from "@/lib/format";
import type { CardItem } from "@/lib/listing";
import type { RoutineAnswers } from "@/lib/routine";
import { useShop } from "@/lib/store";
import { AfterRoutine } from "../clinic/AfterRoutine";
import type { ClinicItem } from "../clinic/ClinicView";

type Step = { id: string; name: string; time: "am" | "pm" | "both"; tip: string; why?: string; skipped?: boolean; picks: CardItem[] };
type Result = { ai: boolean; summary: string; notes: string[]; treatments: ClinicItem[]; clinic?: { partner: string; mock: boolean } };

export function RoutineWizard({ title, intro, skinTypes, concerns, goals, labels = {}, aiReady = false }: { title: string; intro: string; skinTypes: { id: string; label: string; hint: string }[]; concerns: string[]; goals: string[]; labels?: Record<string, string>; aiReady?: boolean }) {
  const tx = useT();
  const { addMany } = useShop();
  const [n, setN] = useState(0);
  const [a, setA] = useState<RoutineAnswers & { pregnant?: boolean; total?: number }>({ skinType: "", concerns: [], goals: [], sensitive: false, budget: "any", length: "full" });
  const [about, setAbout] = useState("");
  const [reading, setReading] = useState(false);
  const [readErr, setReadErr] = useState("");
  const [meta, setMeta] = useState<Result | null>(null);
  async function understand() {
    setReading(true); setReadErr("");
    const r = await fetch("/api/routine/understand/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: about }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setReading(false);
    if (!r?.ok || !d.answers) return setReadErr(tx(d.error ?? "Please answer the questions instead"));
    setA((x) => ({ ...x, ...d.answers, skinType: d.answers.skinType || x.skinType }));
    setN(d.answers.skinType ? 4 : 0);
  }
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const toggle = (k: "concerns" | "goals", v: string, max = 3) =>
    setA((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v].slice(-max) }));

  async function build() {
    setBusy(true);
    const res = await fetch("/api/routine/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...a, about: about || undefined }) });
    const data = await res.json();
    setSteps(data.steps ?? []);
    setMeta({ ai: !!data.ai, summary: data.summary ?? "", notes: data.notes ?? [], treatments: data.treatments ?? [], clinic: data.clinic });
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
          <label className="flex items-center gap-3 rounded-xl border border-line p-4 text-sm sm:col-span-2">
            <input type="checkbox" checked={!!a.pregnant} onChange={(e) => setA({ ...a, pregnant: e.target.checked })} className="h-5 w-5 accent-[#d13f74]" />
            {tx("I'm pregnant or breastfeeding (we'll avoid unsuitable actives)")}
          </label>
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
          {aiReady && (
            <label className="flex flex-wrap items-center gap-3 text-sm">
              {tx("Total budget (optional)")}
              <span className="flex items-center rounded-xl border border-line px-3"><span className="text-muted">$</span><input type="number" inputMode="numeric" min={0} value={a.total ?? ""} onChange={(e) => setA({ ...a, total: e.target.value ? Math.max(0, +e.target.value) : undefined })} className="min-h-[44px] w-24 bg-transparent px-1 outline-none" placeholder="80" /></span>
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice on={a.length === "essential"} onClick={() => setA({ ...a, length: "essential" })} label={tx("Essentials (3 steps)")} hint="Cleanser, moisturiser, sunscreen" />
            <Choice on={a.length === "full"} onClick={() => setA({ ...a, length: "full" })} label={tx("Complete routine")} hint="Adds serum, eye care, toner and night treatment" />
          </div>
        </div>
      ),
    },
  ];

  if (n === 5 && steps) {
    const idx = (s: Step) => chosen[s.id] ?? (s.skipped ? -1 : 0);
    const picked = steps.map((s) => s.picks[idx(s)]).filter((p): p is CardItem => !!p);
    const total = picked.reduce((s, p) => s + p.price, 0);
    const am = steps.filter((s) => s.time !== "pm");
    const pm = steps.filter((s) => s.time !== "am");
    return (
      <div className="container-x max-w-5xl py-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Your routine</p>
        <h1 className="mt-1 text-3xl font-semibold">Here's what we recommend</h1>
        {meta?.ai && meta.summary && (
          <div className="mt-4 rounded-2xl border-2 border-[#d13f74]/30 bg-[#fdf6f8] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d13f74]">✦ {tx("Chosen for you by SuperYou AI")}</p>
            <p className="mt-1 text-sm">{meta.summary}</p>
            {meta.notes.length > 0 && <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-muted">{meta.notes.map((x) => <li key={x}>{x}</li>)}</ul>}
          </div>
        )}
        <p className="mt-2 text-muted">{tx("Tap an alternative to swap a product. Introduce new actives one at a time and patch-test first. Ask our pharmacists on WhatsApp if unsure.")}</p>
        {[["☀️ Morning", am], ["🌙 Evening", pm]].map(([label, list]) => (
          <section key={label as string} className="mt-8">
            <h2 className="mb-3 text-xl font-semibold">{label as string}</h2>
            <ol className="space-y-3">
              {(list as Step[]).map((s, i) => {
                const p = s.picks[idx(s)];
                return (
                  <li key={s.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-start gap-4">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-500 text-sm font-bold text-white">{i + 1}</span>
                      <div className="min-w-48 flex-1">
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-xs text-muted">{s.tip}</p>
                        {s.why && (s.skipped ? idx(s) === -1 : idx(s) === 0) && <p className="mt-1 text-xs font-medium text-[#d13f74]">✦ {s.why}</p>}
                      </div>
                      {p ? (
                        <Link href={`/products/${p.slug}/`} className="flex min-w-64 flex-1 items-center gap-3 rounded-lg bg-brand-50 p-2">
                          <ProductImage product={p} width={120} className="h-16 w-16 rounded" />
                          <span className="flex-1 text-sm leading-snug"><span className="block text-xs font-semibold uppercase text-muted">{p.brand}</span>{p.name}</span>
                          <span className="font-semibold">{money(p.price)}</span>
                        </Link>
                      ) : s.skipped ? <p className="text-sm text-muted">{tx("Optional: not included. Tap a product below to add it.")}</p> : <p className="text-sm text-muted">{tx("No match in stock right now.")}</p>}
                    </div>
                    {(s.picks.length > 1 || (s.skipped && s.picks.length > 0)) && (
                      <div className="ml-12 mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="self-center text-muted">{s.skipped ? tx("Optional:") : "Alternatives:"}</span>
                        {s.picks.map((x, k) => (
                          <button key={x.slug} onClick={() => setChosen({ ...chosen, [s.id]: k })} className={`rounded-full border px-3 py-1 ${k === idx(s) ? "border-brand-500 bg-brand-50 font-semibold" : "border-line"}`}>
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
        {meta && <AfterRoutine items={meta.treatments} partner={meta.clinic?.partner} mock={meta.clinic?.mock} />}
        <div className="sticky bottom-4 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink p-5 text-white shadow-xl">
          <p><span className="text-sm opacity-70">{picked.length} products · </span><b className="text-lg">{money(total)}</b></p>
          <div className="flex gap-2">
            <button onClick={() => (setN(0), setMeta(null))} className="rounded-lg border border-white/30 px-4 py-2.5 text-sm">Start over</button>
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
          {aiReady && (
            <div className="mt-5 rounded-2xl border-2 border-[#d13f74]/30 bg-[#fdf6f8] p-4">
              <label htmlFor="about" className="font-semibold">✦ {tx("Or just tell us about your skin")}</label>
              <textarea id="about" value={about} onChange={(e) => setAbout(e.target.value.slice(0, 600))} placeholder={tx("e.g. I'm 35, oily T-zone, dark spots on my cheeks, my skin gets red easily, budget around $80")} className="mt-2 min-h-[90px] w-full rounded-xl border border-line bg-white p-3 text-base outline-none focus:border-ink md:text-sm" />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button onClick={understand} disabled={reading || about.trim().length < 5} className="min-h-[44px] rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-40">{reading ? tx("Reading…") : tx("Fill in the answers for me")}</button>
                {readErr && <span className="text-sm text-sale">{readErr}</span>}
              </div>
              <p className="mt-2 text-[11px] text-muted">{tx("Our AI fills in the questions; you can check and change them before building your routine.")}</p>
            </div>
          )}
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
          <button onClick={build} disabled={busy} className="rounded-lg bg-brand-500 px-6 py-2.5 font-semibold text-white disabled:opacity-60">{busy ? (aiReady ? tx("Our AI is choosing your products…") : "Building…") : tx("Build my routine")}</button>
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
