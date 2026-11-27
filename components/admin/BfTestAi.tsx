"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AiPlan } from "@/lib/bf-test";

const BLINK = "@keyframes bfblink{0%,100%{opacity:1}50%{opacity:.35}}";
const tone = (m: number | null) => (m === null ? "text-muted" : m < 0 ? "text-sale font-semibold" : m < 10 ? "text-amber-600" : "text-green-700");
const after = (margin: number | null, d: number) => (margin === null ? null : Math.round((1 - (1 - margin / 100) / (1 - d / 100)) * 1000) / 10);

export function BfTestAi({ test }: { test: { on: boolean; at?: string; items?: number } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const post = (body: object) => fetch("/api/admin/black-friday/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

  const [ask1, setAsk1] = useState(false);
  const toggle = async () => {
    if (!test.on && !ask1) { setAsk1(true); return; }
    setAsk1(false);
    setBusy(true);
    await post({ action: test.on ? "test-off" : "test-on" });
    setBusy(false);
    router.refresh();
  };
  const ask = async () => {
    if (!prompt.trim()) return;
    setBusy(true); setMsg(""); setPlan(null);
    const j = await post({ action: "ai", prompt });
    setBusy(false);
    if (j.error) setMsg(j.error); else { setPlan(j); setSkip({}); }
  };
  const apply = async () => {
    if (!plan) return;
    setBusy(true);
    const cur = await fetch("/api/admin/black-friday/").then((r) => r.json());
    const picks = await fetch("/api/admin/black-friday/?picks=1").then((r) => r.json());
    const startsAt = plan.startsAt ? new Date(plan.startsAt).toISOString() : cur.state.startsAt || picks.startsAt || new Date().toISOString();
    const endsAt = plan.endsAt ? new Date(plan.endsAt).toISOString() : cur.state.endsAt || picks.endsAt || "2026-11-30T21:59:00.000Z";
    if (plan.brands.length) {
      const pct: Record<string, number> = {};
      for (const l of cur.lines as { brand: string }[]) { const v = cur.state.pct[l.brand.toLowerCase()]; if (v) pct[l.brand] = v; }
      for (const b of plan.brands) pct[b.brand] = b.pct;
      await post({ startsAt, endsAt, enabled: true, pct });
    }
    const add = plan.products.flatMap((p) => p.matches.filter((m) => !skip[m.slug]).map((m) => ({ slug: m.slug, pct: p.pct })));
    if (add.length) {
      const items = [...(picks.items as { slug: string; pct: number }[]).map(({ slug, pct }) => ({ slug, pct })).filter((i) => !add.some((a) => a.slug === i.slug)), ...add].slice(0, 24);
      await post({ banner: { items, startsAt, endsAt, enabled: true, headline: picks.headline ?? true, fx: picks.fx } });
    }
    setBusy(false);
    setMsg(`Applied: ${plan.brands.length} brands, ${add.length} products. The minimum margin still caps every price.`);
    setPlan(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <style>{BLINK}</style>
      <section className={`rounded-2xl border p-5 ${test.on ? "border-sale bg-red-50" : "border-line bg-white"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Test mode</h2>
            <p className="text-sm text-muted">{test.on ? `On since ${new Date(test.at!).toLocaleString("en-GB", { timeZone: "Asia/Beirut" })}: ${test.items} random products discounted until 30 Nov 23:59. Turn it off to get your own setup back and configure it by hand.` : "One click: random products and discounts (above your minimum margin), the countdown strip, a door a day and confetti, until 30 November. Your own setup is kept and restored when you switch it off."}</p>
          </div>
          <button disabled={busy} onClick={toggle} className={`rounded-full px-6 py-3 font-bold text-white ${test.on ? "bg-sale" : "bg-black"}`} style={test.on ? { animation: "bfblink 1s ease-in-out infinite" } : undefined}>
            {busy ? (test.on ? "Turning off…" : "Turning on…") : test.on ? "● TEST MODE ON · turn off" : ask1 ? "Yes, start the test" : "Start random test"}
          </button>
          {ask1 && !busy && <button onClick={() => setAsk1(false)} className="text-sm underline">Cancel</button>}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Ask AI to set it up</h2>
        <p className="text-sm text-muted">Write what you want; the AI drafts it, you check the margins, then apply. Example: "20% off all La Roche-Posay sunscreens, 15% on Vichy and 10% on Kérastase until Monday night".</p>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="w-full rounded-lg border border-line px-3 py-2 text-sm" placeholder="What discounts do you want for Black Friday?" />
        <button disabled={busy || !prompt.trim()} onClick={ask} className="rounded-lg bg-brand-500 px-5 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Working…" : "Ask AI"}</button>
        {msg && <p className="text-sm">{msg}</p>}
        {plan && (
          <div className="space-y-3 rounded-xl border border-line p-4 text-sm">
            {plan.note && <p className="italic">{plan.note}</p>}
            <p>Dates: {plan.startsAt ? new Date(plan.startsAt).toLocaleString("en-GB", { timeZone: "Asia/Beirut" }) : "unchanged"} → {plan.endsAt ? new Date(plan.endsAt).toLocaleString("en-GB", { timeZone: "Asia/Beirut" }) : "unchanged"}</p>
            {plan.brands.length > 0 && (
              <table className="w-full"><thead><tr className="text-left text-muted"><th>Whole brand</th><th className="text-right">Discount</th><th className="text-right">Margin now</th><th className="text-right">Margin after</th></tr></thead>
                <tbody>{plan.brands.map((b) => { const a = after(b.marginPct, b.pct); return <tr key={b.brand} className="border-t border-line"><td className="py-1">{b.brand}</td><td className="text-right">{b.pct}%</td><td className="text-right">{b.marginPct ?? "?"}%</td><td className={`text-right ${tone(a)}`}>{a === null ? "?" : `${a}%`}</td></tr>; })}</tbody></table>
            )}
            {plan.products.map((p) => (
              <div key={p.query}>
                <p className="font-medium">"{p.query}" · {p.pct}% off · {p.matches.length} products found</p>
                <ul className="mt-1 divide-y divide-line">{p.matches.map((m) => { const a = after(m.maxMarginPct, p.pct); return (
                  <li key={m.slug} className="flex flex-wrap items-center gap-2 py-1">
                    <input type="checkbox" checked={!skip[m.slug]} onChange={(e) => setSkip({ ...skip, [m.slug]: !e.target.checked })} />
                    <span className="flex-1">{m.brand} · {m.name} · ${m.price}</span>
                    <span className="text-xs">max margin {m.maxMarginPct ?? "?"}% → after <b className={tone(a)}>{a === null ? "?" : `${a}%`}</b></span>
                  </li>); })}</ul>
              </div>
            ))}
            <div className="flex gap-2"><button disabled={busy} onClick={apply} className="rounded-lg bg-black px-5 py-2 font-semibold text-white">Apply this plan</button><button onClick={() => setPlan(null)} className="rounded-lg border border-line px-4 py-2">Discard</button></div>
          </div>
        )}
      </section>
    </div>
  );
}
