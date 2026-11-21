"use client";

import { useT } from "@/lib/site-context";

import { useState } from "react";
import { PharmacistButton } from "@/components/Growth";
import { ProductCard } from "@/components/ProductCard";
import type { CardItem } from "@/lib/listing";

const Q = [
  { k: "depth", q: "How light or deep is your skin?", opts: [["fair", "Fair", "#f6e0d3"], ["light", "Light", "#eccab0"], ["medium", "Medium", "#d3a17c"], ["tan", "Tan", "#a8714a"], ["deep", "Deep", "#5e3a24"]] },
  { k: "undertone", q: "Which looks best on you, or which colour are the veins on your wrist?", opts: [["cool", "Silver · blue/purple veins", "#c9cfe6"], ["warm", "Gold · green veins", "#e8cf8a"], ["neutral", "Both · hard to tell", "#d9d2c5"], ["olive", "Greenish-grey cast", "#b9b48c"]] },
  { k: "finish", q: "Which finish do you like?", opts: [["matte", "Matte · no shine"], ["natural", "Natural · like skin"], ["dewy", "Dewy · glowing"]] },
  { k: "coverage", q: "How much coverage?", opts: [["light", "Light · evens tone"], ["medium", "Medium · hides redness"], ["full", "Full · covers spots"]] },
  { k: "skin", q: "Your skin type?", opts: [["oily", "Oily"], ["combination", "Combination"], ["normal", "Normal"], ["dry", "Dry"]] },
] as const;

export function ShadeFinder() {
  const tx = useT();
  const [i, setI] = useState(0);
  const [a, setA] = useState<Record<string, string>>({});
  const [res, setRes] = useState<{ advice: { range: string; tone: string }; picks: CardItem[] } | null>(null);
  const [busy, setBusy] = useState(false);

  async function choose(k: string, v: string) {
    const next = { ...a, [k]: v };
    setA(next);
    if (i < Q.length - 1) return setI(i + 1);
    setBusy(true);
    const r = await fetch("/api/shade-finder/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).catch(() => null);
    setRes(r?.ok ? await r.json() : null);
    setBusy(false);
  }

  if (res)
    return (
      <div className="container-x py-10">
        <h1 className="text-3xl font-bold">Your foundation match</h1>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-[#f5f5f5] p-5"><p className="text-sm text-muted">{tx("Shades to look for")}</p><p className="mt-1 font-semibold">{res.advice.range}</p></div>
          <div className="rounded-2xl bg-[#f5f5f5] p-5"><p className="text-sm text-muted">Undertone letters</p><p className="mt-1 font-semibold">{res.advice.tone}</p></div>
        </div>
        <p className="mt-3 text-sm text-muted">{tx("Brands number shades differently: open a product and choose the shade in that range. Not sure? Send us a daylight selfie on WhatsApp and a pharmacist will pick for you.")}</p>
        <PharmacistButton product="choosing my foundation shade" className="mt-4 max-w-md" />
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">{res.picks.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        <button onClick={() => (setRes(null), setI(0), setA({}))} className="mt-6 text-sm underline">Start again</button>
      </div>
    );

  const q = Q[i];
  return (
    <div className="container-x max-w-2xl py-12">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted">Shade finder · {i + 1}/{Q.length}</p>
      <h1 className="mt-2 text-3xl font-bold">{tx(q.q)}</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(q.opts as readonly (readonly string[])[]).map((o) => (
          <button key={o[0]} disabled={busy} onClick={() => choose(q.k, o[0])} className={`tap flex items-center gap-3 rounded-xl border p-4 text-start ${a[q.k] === o[0] ? "border-ink" : "border-line hover:border-ink"}`}>
            {o[2] && <span className="h-8 w-8 shrink-0 rounded-full border border-line" style={{ background: o[2] }} />}
            <span className="font-medium">{tx(o[1])}</span>
          </button>
        ))}
      </div>
      {i > 0 && <button onClick={() => setI(i - 1)} className="mt-6 text-sm underline">{tx("Back")}</button>}
    </div>
  );
}
