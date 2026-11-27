"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { store } from "@/lib/config";
import { buildPalette, contrast, defaultTheme, isHex, presets, type Palette, type ThemeInput } from "@/lib/theme";

const fields: { key: keyof ThemeInput; label: string; help: string }[] = [
  { key: "primary", label: "Brand colour", help: "Buttons, links, announcement bar, highlights" },
  { key: "ink", label: "Text & dark", help: "Headings, body text, footer, timers" },
  { key: "sale", label: "Sale & discount", help: "−% badges and sale prices" },
  { key: "background", label: "Page background", help: "Usually white or a soft off-white" },
];

const swatchNames: Record<keyof Palette, string> = {
  "brand-50": "Brand tint 50",
  "brand-100": "Brand tint 100",
  "brand-500": "Brand 500",
  "brand-600": "Brand 600 (hover)",
  "brand-700": "Brand 700 (deep)",
  ink: "Ink",
  muted: "Muted text",
  line: "Lines & borders",
  sale: "Sale",
  bg: "Background",
};

function download(name: string, content: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function swatchSheetSvg(p: Palette, title: string) {
  const entries = Object.entries(p) as [keyof Palette, string][];
  const w = 200, h = 230, cols = 5, pad = 40;
  const W = pad * 2 + cols * w + (cols - 1) * 20;
  const rows = Math.ceil(entries.length / cols);
  const H = 120 + rows * (h + 20) + pad;
  const cells = entries
    .map(([k, v], i) => {
      const x = pad + (i % cols) * (w + 20), y = 110 + Math.floor(i / cols) * (h + 20);
      return `<g><rect x="${x}" y="${y}" width="${w}" height="150" rx="16" fill="${v}" stroke="#00000014"/><text x="${x}" y="${y + 180}" font-size="16" font-weight="600" fill="#222">${xml(swatchNames[k])}</text><text x="${x}" y="${y + 204}" font-size="15" fill="#666" font-family="monospace">${v.toUpperCase()}</text></g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, sans-serif"><rect width="100%" height="100%" fill="#fff"/><text x="${pad}" y="66" font-size="30" font-weight="700" fill="#222">${xml(title)} colour palette</text>${cells}</svg>`;
}

export function ThemeEditor({ initial }: { initial: ThemeInput }) {
  const router = useRouter();
  const [t, setT] = useState<ThemeInput>(initial);
  const [draft, setDraft] = useState<ThemeInput>(initial); // text inputs (may be mid-typing)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState("");

  const p = useMemo(() => buildPalette(t), [t]);
  const changed = JSON.stringify(t) !== JSON.stringify(initial);

  const set = (k: keyof ThemeInput, v: string) => {
    setDraft((d) => ({ ...d, [k]: v }));
    const val = v.startsWith("#") ? v : `#${v}`;
    if (isHex(val)) setT((x) => ({ ...x, [k]: val.toLowerCase() }));
  };
  const apply = (theme: ThemeInput) => { setT(theme); setDraft(theme); setMsg(null); };

  const checks = [
    { label: "White text on brand buttons", ratio: contrast("#ffffff", p["brand-500"]), min: 3 },
    { label: "Body text on background", ratio: contrast(p.ink, p.bg), min: 4.5 },
    { label: "Muted text on background", ratio: contrast(p.muted, p.bg), min: 3 },
    { label: "White text on sale badges", ratio: contrast("#ffffff", p.sale), min: 3 },
  ];

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/theme/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t) });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Saved — the shop now uses these colours" } : { ok: false, text: data.error });
    if (res.ok) router.refresh();
  }

  const copy = async (v: string) => {
    try { await navigator.clipboard.writeText(v); setCopied(v); setTimeout(() => setCopied(""), 1200); } catch { /* clipboard blocked */ }
  };

  const slug = store.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const exports = {
    css: () =>
      download(
        `${slug}-palette.css`,
        `/* ${store.name} colour palette */\n:root {\n${Object.entries(p).map(([k, v]) => `  --color-${k}: ${v};`).join("\n")}\n}\n`,
        "text/css",
      ),
    json: () => download(`${slug}-palette.json`, JSON.stringify({ name: store.name, picked: t, palette: p }, null, 2), "application/json"),
    svg: () => download(`${slug}-palette.svg`, swatchSheetSvg(p, store.name), "image/svg+xml"),
  };

  const card = "rounded-xl bg-white p-5 shadow-sm";
  // Preview uses the palette as local CSS variables, so Tailwind's brand classes pick them up.
  const previewVars = Object.fromEntries(Object.entries(p).map(([k, v]) => [`--color-${k}`, v])) as React.CSSProperties;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Appearance</h1>
          <p className="text-sm text-muted">Pick four colours — every shade is built from them. Changes go live for everyone when you save.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {msg && <span className={`text-sm ${msg.ok ? "text-brand-600" : "text-sale"}`}>{msg.text}</span>}
          <button onClick={() => apply(initial)} disabled={!changed || busy} className="rounded-lg border border-line bg-white px-4 py-2 text-sm disabled:opacity-40">Undo changes</button>
          <button onClick={save} disabled={!changed || busy} className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40">
            {busy ? "Saving…" : "Save & publish"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <section className={card}>
            <h2 className="font-semibold">Ready-made palettes</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {presets.map((pr) => {
                const pp = buildPalette(pr.theme);
                const active = JSON.stringify(pr.theme) === JSON.stringify(t);
                return (
                  <button key={pr.name} onClick={() => apply(pr.theme)} className={`rounded-xl border p-3 text-left transition hover:shadow ${active ? "border-ink ring-1 ring-ink" : "border-line"}`}>
                    <span className="flex h-8 overflow-hidden rounded-md">
                      {[pp["brand-700"], pp["brand-500"], pp["brand-100"], pp.ink, pp.sale].map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
                    </span>
                    <span className="mt-2 block text-sm font-semibold">{pr.name}</span>
                    <span className="block text-xs text-muted">{pr.note}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={card}>
            <h2 className="font-semibold">Your colours</h2>
            <div className="mt-3 space-y-4">
              {fields.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <input type="color" value={t[f.key]} onChange={(e) => set(f.key, e.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-white p-1" aria-label={f.label} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{f.label}</p>
                    <p className="text-xs text-muted">{f.help}</p>
                  </div>
                  <input
                    value={draft[f.key]}
                    onChange={(e) => set(f.key, e.target.value.trim())}
                    className={`w-28 rounded-lg border px-2 py-1.5 font-mono text-sm uppercase ${isHex(draft[f.key].startsWith("#") ? draft[f.key] : `#${draft[f.key]}`) ? "border-line" : "border-sale"}`}
                  />
                </div>
              ))}
            </div>
            <button onClick={() => apply(defaultTheme)} className="mt-4 text-xs text-muted underline">Reset to SuperYou default</button>
          </section>

          <section className={card}>
            <h2 className="font-semibold">Readability check</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {checks.map((c) => {
                const ok = c.ratio >= c.min;
                return (
                  <li key={c.label} className="flex items-center justify-between gap-3">
                    <span>{c.label}</span>
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {c.ratio.toFixed(1)}:1 {ok ? "✓ good" : "· too light"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-muted">Based on the WCAG accessibility guideline. “Too light” means some customers will struggle to read it — try a deeper shade.</p>
          </section>
        </div>

        <div className="space-y-6">
          <section className={card}>
            <h2 className="mb-3 font-semibold">Live preview</h2>
            <div style={{ ...previewVars, background: p.bg }} className="overflow-hidden rounded-xl border border-line text-ink">
              <div className="bg-brand-600 px-4 py-1.5 text-center text-[11px] font-medium text-white">Free delivery on orders over $30</div>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/superyou-logo.svg" alt="" className="h-4" />
                <span className="rounded-full border border-line px-3 py-1 text-[11px] text-muted">Search products…</span>
              </div>
              <div className="m-4 rounded-xl px-5 py-6 text-white" style={{ background: `linear-gradient(90deg, ${p.ink}, ${p["brand-500"]})` }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Black November</p>
                <p className="mt-1 text-xl font-bold">Buy 1, get 1 at 35% off</p>
                <span className="mt-3 inline-block rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-ink">Shop the offer</span>
              </div>
              <div className="grid grid-cols-2 gap-3 px-4 pb-4">
                {[{ n: "Hydra Barrier Serum", pr: "$14.40", was: "$24.00", d: "-40%" }, { n: "Vitamin C 20% Serum", pr: "$9.80", was: "", d: "" }].map((x) => (
                  <div key={x.n} className="rounded-lg border border-line p-2.5">
                    <div className="relative grid aspect-[4/3] place-items-center rounded-md bg-brand-50">
                      {x.d && <span className="absolute left-1.5 top-1.5 rounded bg-sale px-1.5 text-[10px] font-bold text-white">{x.d}</span>}
                      <span className="h-10 w-6 rounded-md bg-brand-100" />
                    </div>
                    <p className="mt-2 text-[10px] font-semibold uppercase text-muted">Brand</p>
                    <p className="text-xs font-medium">{x.n}</p>
                    <p className="mt-1 text-xs">
                      <b className={x.was ? "text-sale" : ""}>{x.pr}</b> {x.was && <s className="text-muted">{x.was}</s>}
                    </p>
                    <span className="mt-2 block rounded-md bg-brand-500 py-1.5 text-center text-[11px] font-semibold text-white">Add to bag</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 px-4 pb-4">
                <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] text-brand-700">Dryness</span>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-[11px] text-brand-700">Sensitive skin</span>
                <span className="ml-auto text-[11px] font-semibold text-brand-600 underline">View all</span>
              </div>
              <div className="bg-ink px-4 py-3 text-[11px] text-white/70">Footer · © {store.name}</div>
            </div>
          </section>

          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Full palette</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="self-center text-muted">Download:</span>
                <button onClick={exports.svg} className="rounded-lg border border-line px-3 py-1.5 font-semibold hover:bg-brand-50">Swatch sheet (SVG)</button>
                <button onClick={exports.css} className="rounded-lg border border-line px-3 py-1.5 font-semibold hover:bg-brand-50">CSS</button>
                <button onClick={exports.json} className="rounded-lg border border-line px-3 py-1.5 font-semibold hover:bg-brand-50">JSON</button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(Object.entries(p) as [keyof Palette, string][]).map(([k, v]) => (
                <button key={k} onClick={() => copy(v)} title="Copy hex" className="text-left">
                  <span className="block h-14 rounded-lg border border-black/5" style={{ background: v }} />
                  <span className="mt-1.5 block text-[11px] font-semibold leading-tight">{swatchNames[k]}</span>
                  <span className="block font-mono text-[11px] text-muted">{copied === v ? "Copied!" : v.toUpperCase()}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Tap a swatch to copy its code. The logo artwork keeps its own rose colours; ask for a recoloured logo if you move far from rose.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
