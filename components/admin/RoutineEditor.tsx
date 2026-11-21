"use client";

import { useState } from "react";
import type { Taxonomy } from "@/lib/data/catalog";
import { defaultRoutine, type RoutineConfig, type RoutineStep } from "@/lib/routine";
import { Area, Card, Chips, Header, ListInput, Num, ProductPicker, Select, Text, Toggle, move, useSaver } from "./fields";

export function RoutineEditor({ initial, taxonomy }: { initial: RoutineConfig; taxonomy: Taxonomy }) {
  const [c, setC] = useState<RoutineConfig>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const saver = useSaver("/api/admin/routine/");
  const up = (patch: Partial<RoutineConfig>) => (saver.touch(), setC({ ...c, ...patch }));
  const upStep = (i: number, patch: Partial<RoutineStep>) => up({ steps: c.steps.map((s, n) => (n === i ? { ...s, ...patch } : s)) });
  const catOpts = taxonomy.categories.map((x) => ({ value: x.slug, label: x.name }));

  return (
    <div>
      <Header
        title="Routine finder"
        sub="The skincare quiz at /routine — customers answer 5 questions and get a morning & evening routine from your catalog"
        saver={saver}
        onSave={() => saver.save(c)}
        extra={<a href="/routine/" target="_blank" className="text-sm text-brand-600 hover:underline">Try it ↗</a>}
      />
      <div className="space-y-5">
        <Card title="General">
          <div className="grid gap-4 md:grid-cols-2">
            <Toggle label="Routine finder is live" hint="Adds “Routine finder” to the menu" checked={c.enabled} onChange={(enabled) => up({ enabled })} />
            <Num label="Alternatives shown per step" value={c.alternatives} onChange={(alternatives) => up({ alternatives: Math.max(0, Math.min(5, alternatives)) })} />
            <Text label="Title" value={c.title} onChange={(title) => up({ title })} />
            <Area label="Introduction" rows={2} value={c.intro} onChange={(intro) => up({ intro })} />
          </div>
        </Card>

        <Card title="Routine steps" sub="Each step picks the best in-stock product whose name contains one of its keywords (and none of the excluded words), ranked by the customer's answers. Pin SKUs to always offer them first.">
          <ol className="space-y-2">
            {c.steps.map((s, i) => (
              <li key={s.id} className="rounded-lg border border-line">
                <div className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="w-5 text-muted">{i + 1}</span>
                  <button onClick={() => setOpen(open === s.id ? null : s.id)} className="flex-1 text-left">
                    <b>{s.name}</b> <span className="text-muted">· {s.time === "both" ? "AM & PM" : s.time.toUpperCase()}{s.essential ? " · essential" : ""} · {s.keywords.slice(0, 4).join(", ")}…</span>
                  </button>
                  <button disabled={i === 0} onClick={() => up({ steps: move(c.steps, i, -1) })} className="px-1.5 disabled:opacity-30">↑</button>
                  <button disabled={i === c.steps.length - 1} onClick={() => up({ steps: move(c.steps, i, 1) })} className="px-1.5 disabled:opacity-30">↓</button>
                  <button onClick={() => up({ steps: c.steps.filter((_, n) => n !== i) })} className="px-1.5 text-sale">✕</button>
                </div>
                {open === s.id && (
                  <div className="grid gap-4 border-t border-line p-4 md:grid-cols-2">
                    <Text label="Step name" value={s.name} onChange={(name) => upStep(i, { name })} />
                    <Select label="When" value={s.time} onChange={(time) => upStep(i, { time })} options={[["both", "Morning & evening"], ["am", "Morning"], ["pm", "Evening"]]} />
                    <ListInput label="Product name must contain one of" rows={3} value={s.keywords} onChange={(keywords) => upStep(i, { keywords })} hint="One per line" />
                    <ListInput label="…and none of" rows={3} value={s.exclude} onChange={(exclude) => upStep(i, { exclude })} hint="One per line" />
                    <div className="md:col-span-2"><Chips label="Look in categories" options={catOpts} value={s.categories} onChange={(categories) => upStep(i, { categories })} /></div>
                    <Area label="How-to tip shown to the customer" rows={2} value={s.tip} onChange={(tip) => upStep(i, { tip })} />
                    <Toggle label="Part of the 3-step essentials routine" checked={s.essential} onChange={(essential) => upStep(i, { essential })} />
                    <div className="md:col-span-2"><ProductPicker label="Pinned products (offered first)" value={s.pinned} onChange={(pinned) => upStep(i, { pinned })} max={20} /></div>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex gap-2">
            <button onClick={() => up({ steps: [...c.steps, { id: `step-${Date.now().toString(36)}`, name: "New step", time: "both", essential: false, keywords: ["mask"], exclude: [], categories: ["skincare"], tip: "", pinned: [] }] })} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-brand-50">+ Add step</button>
            <button onClick={() => window.confirm("Reset steps to the recommended defaults?") && up({ steps: defaultRoutine.steps })} className="rounded-lg border border-line px-3 py-1.5 text-sm">Reset to defaults</button>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Skin types" sub="Keywords favour products made for that skin type">
            {c.skinTypes.map((t, i) => (
              <div key={t.id} className="mb-3 grid gap-2 rounded-lg border border-line p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Text label="Label" value={t.label} onChange={(label) => up({ skinTypes: c.skinTypes.map((x, n) => (n === i ? { ...x, label } : x)) })} />
                  <Text label="Hint" value={t.hint} onChange={(hint) => up({ skinTypes: c.skinTypes.map((x, n) => (n === i ? { ...x, hint } : x)) })} />
                </div>
                <ListInput label="Keywords" value={t.keywords} onChange={(keywords) => up({ skinTypes: c.skinTypes.map((x, n) => (n === i ? { ...x, keywords } : x)) })} />
              </div>
            ))}
          </Card>
          <div className="space-y-5">
            <Card title="Concern answers" sub="What customers can pick in question 2, linked to your concerns and to name keywords">
              {c.concernOptions.map((o, i) => (
                <div key={i} className="mb-3 grid gap-2 rounded-lg border border-line p-3">
                  <div className="flex gap-2">
                    <Text className="flex-1" label="Answer" value={o.label} onChange={(label) => up({ concernOptions: c.concernOptions.map((x, n) => (n === i ? { ...x, label } : x)) })} />
                    <button onClick={() => up({ concernOptions: c.concernOptions.filter((_, n) => n !== i) })} className="self-end pb-2 text-sale">✕</button>
                  </div>
                  <Chips label="Matches products tagged with" options={taxonomy.concerns.map((k) => ({ value: k.slug, label: k.name }))} value={o.concerns} onChange={(concerns) => up({ concernOptions: c.concernOptions.map((x, n) => (n === i ? { ...x, concerns } : x)) })} />
                  <ListInput label="…or names containing" value={o.keywords} onChange={(keywords) => up({ concernOptions: c.concernOptions.map((x, n) => (n === i ? { ...x, keywords } : x)) })} />
                </div>
              ))}
              <button onClick={() => up({ concernOptions: [...c.concernOptions, { label: "New concern", concerns: [], keywords: [] }] })} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-brand-50">+ Add answer</button>
            </Card>
            <Card title="Goals (question 3)">
              {c.goals.map((g, i) => (
                <div key={i} className="mb-2 flex items-end gap-2">
                  <Text className="flex-1" label="Goal" value={g.label} onChange={(label) => up({ goals: c.goals.map((x, n) => (n === i ? { ...x, label } : x)) })} />
                  <ListInput className="flex-1" label="Keywords" value={g.keywords} onChange={(keywords) => up({ goals: c.goals.map((x, n) => (n === i ? { ...x, keywords } : x)) })} />
                  <button onClick={() => up({ goals: c.goals.filter((_, n) => n !== i) })} className="pb-2 text-sale">✕</button>
                </div>
              ))}
              <button onClick={() => up({ goals: [...c.goals, { label: "New goal", keywords: [] }] })} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-brand-50">+ Add goal</button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
