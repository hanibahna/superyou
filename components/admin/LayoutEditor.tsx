"use client";

import { useState } from "react";
import { layoutPresets, type LayoutOptions } from "@/lib/layouts";
import { Card, Header, Select, Toggle, useSaver } from "./fields";

const fontCss: Record<string, string> = {
  sans: "ui-sans-serif, system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  rounded: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif",
  mono: "ui-monospace, Menlo, monospace",
  instrument: "'Instrument Serif', serif",
  fraunces: "Fraunces, serif",
  grotesk: "'Space Grotesk', sans-serif",
  inter: "Inter, sans-serif",
  condensed: "'Avenir Next Condensed', 'Arial Narrow', sans-serif",
};
const radiusPx = { none: 0, small: 4, medium: 10, large: 18 };

export function LayoutEditor({ initial }: { initial: LayoutOptions }) {
  const [o, setO] = useState<LayoutOptions>(initial);
  const saver = useSaver("/api/admin/layout/");
  const up = (patch: Partial<LayoutOptions>) => (saver.touch(), setO({ ...o, ...patch, preset: "preset" in patch ? patch.preset! : ["atelier", "pop", "ritual"].includes(o.preset) ? o.preset : "custom" }));

  return (
    <div>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Space+Grotesk:wght@500;700&family=Inter:wght@400;600&display=swap" />
      <Header title="Theme layout" sub="The shape and feel of the shop: fonts, corners, buttons, cards, header and product photos. Colours are below." saver={saver} onSave={() => saver.save(o)} extra={<a href="/" target="_blank" className="text-sm text-brand-600 hover:underline">Preview ↗</a>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {layoutPresets.map((p) => (
          <button key={p.id} onClick={() => up({ ...p.options, preset: p.id })} className={`overflow-hidden rounded-xl border-2 bg-white text-left transition ${o.preset === p.id ? "border-brand-500" : "border-transparent hover:border-line"}`}>
            <Mini o={p.options} />
            <div className="p-3">
              <p className="font-semibold">{p.name} {o.preset === p.id && <span className="text-xs text-brand-600">· selected</span>}</p>
              <p className="text-xs text-muted">{p.note}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card title="Fine-tune" sub={o.preset === "custom" ? "Custom layout" : `Based on ${layoutPresets.find((p) => p.id === o.preset)?.name}`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Heading font" value={o.headingFont} onChange={(headingFont) => up({ headingFont })} options={[["sans", "Modern sans"], ["serif", "Elegant serif"], ["rounded", "Soft rounded"], ["grotesk", "Bold grotesk"], ["instrument", "Display serif"], ["fraunces", "Soft serif"], ["condensed", "Condensed"], ["mono", "Typewriter"]]} />
            <Select label="Body font" value={o.bodyFont} onChange={(bodyFont) => up({ bodyFont })} options={[["sans", "Modern sans"], ["serif", "Elegant serif"], ["rounded", "Soft rounded"], ["inter", "Inter"]]} />
            <Select label="Corners" value={o.radius} onChange={(radius) => up({ radius })} options={[["none", "Square"], ["small", "Slightly rounded"], ["medium", "Rounded"], ["large", "Very rounded"]]} />
            <Select label="Buttons" value={o.buttons} onChange={(buttons) => up({ buttons })} options={[["pill", "Pill"], ["rounded", "Rounded"], ["square", "Square"]]} />
            <Select label="Product cards" value={o.cards} onChange={(cards) => up({ cards })} options={[["plain", "Plain"], ["border", "Outlined"], ["shadow", "Shadow"], ["tinted", "Tinted"]]} />
            <Select label="Header" value={o.header} onChange={(header) => up({ header })} options={[["classic", "Classic (logo left)"], ["centered", "Centered logo"], ["dark", "Dark"], ["minimal", "Minimal"]]} />
            <Select label="Product photo shape" value={o.imageRatio} onChange={(imageRatio) => up({ imageRatio })} options={[["square", "Square"], ["portrait", "Tall (4:5)"], ["landscape", "Wide (4:3)"]]} />
            <Select label="Spacing" value={o.density} onChange={(density) => up({ density })} options={[["compact", "Compact"], ["comfortable", "Comfortable"], ["spacious", "Spacious"]]} />
            <Select label="Products per row (desktop)" value={String(o.gridColumns) as "3" | "4" | "5"} onChange={(v) => up({ gridColumns: Number(v) as 3 | 4 | 5 })} options={[["3", "3"], ["4", "4"], ["5", "5"]]} />
            <Select label="Add-to-cart buttons" value={o.buyButton ?? "solid"} onChange={(buyButton) => up({ buyButton })} options={[["solid", "Filled"], ["outline", "Outlined"], ["hover", "Show on hover (Sephora)"]]} />
            <div className="self-end pb-2"><Toggle label="Uppercase headings" checked={o.uppercaseHeadings} onChange={(uppercaseHeadings) => up({ uppercaseHeadings })} /></div>
          </div>
        </Card>
        <Card title="Preview">
          <div className="scale-100"><Mini o={o} big /></div>
        </Card>
      </div>
    </div>
  );
}

function Mini({ o, big = false }: { o: LayoutOptions; big?: boolean }) {
  const r = radiusPx[o.radius];
  const btnR = o.buttons === "pill" ? 999 : o.buttons === "rounded" ? 6 : 0;
  const card = (k: number) => ({
    borderRadius: r,
    border: o.cards === "border" ? "1px solid #e5e5e5" : "1px solid transparent",
    boxShadow: o.cards === "shadow" ? "0 4px 14px -6px rgba(0,0,0,.25)" : undefined,
    background: o.cards === "tinted" ? "var(--color-brand-50)" : "#fff",
    padding: 4,
    key: k,
  });
  const cols = big ? o.gridColumns : Math.min(o.gridColumns, 4);
  return (
    <div className={`${big ? "" : "pointer-events-none"} bg-white`} style={{ fontFamily: fontCss[o.bodyFont] }}>
      <div className="flex items-center gap-2 px-3 py-2 text-[10px]" style={{ background: o.header === "dark" ? "var(--color-ink)" : "#fff", color: o.header === "dark" ? "#fff" : undefined, justifyContent: o.header === "centered" ? "center" : "flex-start", borderBottom: o.header === "minimal" ? "none" : "1px solid #eee" }}>
        <b style={{ fontFamily: fontCss[o.headingFont] }}>superyou</b>
      </div>
      <div className="p-3">
        <div className="mb-2 rounded p-3 text-white" style={{ borderRadius: r, background: "linear-gradient(90deg, var(--color-ink), var(--color-brand-500))" }}>
          <p className="text-[11px] font-bold" style={{ fontFamily: fontCss[o.headingFont], textTransform: o.uppercaseHeadings ? "uppercase" : undefined }}>New in skincare</p>
          <span className="mt-1 inline-block bg-white px-2 py-0.5 text-[8px] text-ink" style={{ borderRadius: btnR }}>Shop now</span>
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: o.density === "compact" ? 4 : o.density === "spacious" ? 10 : 6 }}>
          {Array.from({ length: cols }).map((_, k) => {
            const { key, ...style } = card(k);
            return (
              <div key={key} style={style}>
                <div className="bg-brand-100" style={{ aspectRatio: o.imageRatio === "portrait" ? "4/5" : o.imageRatio === "landscape" ? "4/3" : "1/1", borderRadius: Math.max(0, r - 2) }} />
                <div className="mt-1 h-1 w-3/4 rounded bg-line" />
                <div className="mt-1 h-3 rounded-sm bg-brand-500" style={{ borderRadius: btnR }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
