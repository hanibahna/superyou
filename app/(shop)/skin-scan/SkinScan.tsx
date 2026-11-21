"use client";

import { useT } from "@/lib/site-context";

import Link from "next/link";
import { useRef, useState } from "react";
import { PharmacistButton } from "@/components/Growth";
import { ProductCard } from "@/components/ProductCard";
import type { CardItem } from "@/lib/listing";
import { useShop } from "@/lib/store";

type Step = { id: string; name: string; time: string; tip: string; picks: CardItem[] };
type Analysis = { skinType?: string; concerns: string[]; sensitive: boolean; observations: string[]; advice: string };

/** Shrinks the photo in the browser (max 1024 px JPEG) before upload. */
async function shrink(file: File) {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1024 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

export function SkinScan({ intro, ready }: { intro: string; ready: boolean }) {
  const tx = useT();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<{ analysis: Analysis; steps: Step[] } | null>(null);
  const [consent, setConsent] = useState(false);
  const { addMany, setDrawerOpen } = useShop();

  async function pick(f?: File) {
    if (!f) return;
    setErr("");
    setRes(null);
    const data = await shrink(f).catch(() => "");
    if (!data) return setErr(tx("We couldn't open that photo. Try a JPG or PNG."));
    setPreview(data);
    setBusy(true);
    const r = await fetch("/api/skin-scan/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: data }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return setErr(d.error === "not_configured" ? tx("The AI skin scan isn't switched on yet. Use the quiz instead — it takes a minute.") : d.error ?? "Please try again");
    setRes(d);
  }

  const firstPicks = res?.steps.map((s) => s.picks[0]).filter(Boolean) ?? [];
  return (
    <div className="container-x max-w-5xl py-10">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-sale">{tx("New")}</p>
      <h1 className="mt-1 text-4xl font-black">{tx("AI skin scan")}</h1>
      <p className="mt-3 max-w-2xl text-muted">{intro}</p>
      {!ready && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">{tx("The AI scan isn't connected yet.")} <Link href="/routine/" className="font-semibold underline">Take the 1-minute routine quiz</Link> instead.</p>}

      <div className="mt-8 grid gap-8 md:grid-cols-[320px_1fr]">
        <div>
          <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded-2xl bg-[#f5f5f5]">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Your photo" className="h-full w-full object-cover" />
            ) : (
              <p className="p-6 text-center text-sm text-muted">{tx("Face the light, no make-up, hair away from your face.")}</p>
            )}
          </div>
          <label className="mt-3 flex items-start gap-2 text-xs text-muted"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" /> {tx("I agree that my photo is sent once to an AI service to read my skin. It isn't stored.")}</label>
          <input ref={input} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <button disabled={!consent || busy || !ready} onClick={() => input.current?.click()} className="tap mt-3 w-full rounded-full bg-ink font-semibold text-white disabled:opacity-40">{busy ? tx("Reading your skin…") : preview ? "Try another photo" : "Take or upload a selfie"}</button>
          {err && <p className="mt-3 text-sm text-sale">{err}</p>}
          <p className="mt-4 text-[11px] text-muted">{tx("Cosmetic guidance only — not a medical diagnosis.")}</p>
        </div>
        <div>
          {res ? (
            <>
              <div className="rounded-2xl border border-line p-5">
                <p className="text-sm text-muted">Your skin today</p>
                <p className="mt-1 text-2xl font-bold">{res.analysis.skinType} skin{res.analysis.sensitive ? ", easily irritated" : ""}</p>
                {res.analysis.concerns.length > 0 && <p className="mt-1 text-sm">Focus: {res.analysis.concerns.join(" · ")}</p>}
                <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-muted">{res.analysis.observations.map((o) => <li key={o}>{o}</li>)}</ul>
                {res.analysis.advice && <p className="mt-3 text-xs text-muted">{res.analysis.advice}</p>}
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Your routine</h2>
                {firstPicks.length > 0 && <button onClick={() => (addMany(firstPicks), setDrawerOpen(true))} className="tap rounded-full bg-ink px-5 text-sm font-semibold text-white">Add the whole routine ({firstPicks.length})</button>}
              </div>
              <div className="mt-4 space-y-6">
                {res.steps.map((s, i) => (
                  <div key={s.id}>
                    <p className="font-semibold">{i + 1}. {s.name} <span className="text-xs font-normal uppercase text-muted">{s.time === "both" ? "AM + PM" : s.time.toUpperCase()}</span></p>
                    <p className="text-sm text-muted">{s.tip}</p>
                    <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">{s.picks.slice(0, 3).map((p) => <ProductCard key={p.id} product={p} />)}</div>
                  </div>
                ))}
              </div>
              <PharmacistButton product="my skin scan results" className="mt-6" />
            </>
          ) : (
            <ol className="space-y-4 text-sm">
              {["Take a selfie in daylight, facing the window.", tx("The AI reads visible skin type, shine, redness, dryness and spots."), "We build a morning and evening routine from products in stock — add it to your bag in one tap."].map((x, i) => (
                <li key={x} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">{i + 1}</span><span className="pt-1">{x}</span></li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
