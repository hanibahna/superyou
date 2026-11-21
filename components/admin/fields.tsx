"use client";

// Small form building blocks shared by the admin editors.

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { imgUrl } from "@/lib/img";
import { parseVideo } from "@/lib/site";

export const inputCls = "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-500";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Text({ label, hint, value, onChange, placeholder, className, type = "text" }: { label: string; hint?: React.ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; className?: string; type?: string }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
    </Field>
  );
}

export function Area({ label, hint, value, onChange, rows = 3, placeholder, className }: { label: string; hint?: React.ReactNode; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; className?: string }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={inputCls} />
    </Field>
  );
}

export function Num({ label, hint, value, onChange, step = 1, min = 0, className }: { label: string; hint?: React.ReactNode; value: number; onChange: (v: number) => void; step?: number; min?: number; className?: string }) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => setRaw((r) => (Number(r) === value ? r : String(value))), [value]);
  return (
    <Field label={label} hint={hint} className={className}>
      <input type="number" step={step} min={min} value={raw} onChange={(e) => { setRaw(e.target.value); const n = Number(e.target.value); if (e.target.value !== "" && !Number.isNaN(n)) onChange(n); }} className={inputCls} />
    </Field>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-brand-500" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
      <span><span className="font-medium">{label}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
    </label>
  );
}

export function Select<T extends string>({ label, hint, value, onChange, options, className }: { label: string; hint?: React.ReactNode; value: T; onChange: (v: T) => void; options: [T, string][]; className?: string }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={inputCls}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Field>
  );
}

/** Comma/line separated list edited as text. */
export function ListInput({ label, hint, value, onChange, rows = 1, placeholder, className }: { label: string; hint?: React.ReactNode; value: string[]; onChange: (v: string[]) => void; rows?: number; placeholder?: string; className?: string }) {
  const [raw, setRaw] = useState(value.join(rows > 1 ? "\n" : ", "));
  const parse = (s: string) => s.split(rows > 1 ? /\n/ : /,/).map((x) => x.trim()).filter(Boolean);
  useEffect(() => setRaw((r) => (JSON.stringify(parse(r)) === JSON.stringify(value) ? r : value.join(rows > 1 ? "\n" : ", "))), [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Field label={label} hint={hint} className={className}>
      {rows > 1 ? (
        <textarea rows={rows} value={raw} placeholder={placeholder} onChange={(e) => { setRaw(e.target.value); onChange(parse(e.target.value)); }} className={inputCls} />
      ) : (
        <input value={raw} placeholder={placeholder} onChange={(e) => { setRaw(e.target.value); onChange(parse(e.target.value)); }} className={inputCls} />
      )}
    </Field>
  );
}

/** Multi-select chips. */
export function Chips({ label, hint, options, value, onChange }: { label: string; hint?: React.ReactNode; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="text-sm">
      <p className="mb-1 font-medium">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button type="button" key={o.value} onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])} className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-brand-500 bg-brand-500 text-white" : "border-line hover:border-brand-500"}`}>
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

async function uploadFile(file: File): Promise<string> {
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const blob = await upload(`media/${safe}`, file, { access: "public", handleUploadUrl: "/api/admin/upload/client/" });
  return blob.url;
}

/** Image or video: paste a link or upload a file (Vercel Blob). */
export function MediaField({ label, hint, value, onChange, kind = "image" }: { label: string; hint?: React.ReactNode; value: string; onChange: (v: string) => void; kind?: "image" | "video" }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const v = kind === "video" ? parseVideo(value) : null;
  return (
    <Field label={label} hint={err ? <span className="text-sale">{err}</span> : hint}>
      <div className="flex gap-2">
        <input value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder={kind === "video" ? "YouTube, TikTok, Instagram, Vimeo link — or upload" : "https://… — or upload"} className={inputCls} />
        <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="shrink-0 rounded-lg border border-line px-3 text-sm hover:bg-brand-50 disabled:opacity-50">{busy ? "Uploading…" : "Upload"}</button>
        {value && <button type="button" onClick={() => onChange("")} className="shrink-0 rounded-lg border border-line px-2 text-sm text-sale">✕</button>}
      </div>
      <input
        ref={ref} type="file" hidden accept={kind === "video" ? "video/mp4,video/webm,video/quicktime" : "image/*"}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          setErr("");
          try { onChange(await uploadFile(f)); } catch (x) { setErr((x as Error).message || "Upload failed. Is Vercel Blob connected?"); }
          setBusy(false);
        }}
      />
      {value && kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgUrl(value, 240)} alt="" className="mt-2 h-20 rounded border border-line object-contain" />
      )}
      {value && kind === "video" && <span className="mt-1 block text-xs text-brand-700">{v ? `✓ ${v.kind === "file" ? "Video file" : v.kind[0].toUpperCase() + v.kind.slice(1)} link recognised` : "⚠ Not a recognised video link"}</span>}
    </Field>
  );
}

/** Save button + status for a whole document. */
export function useSaver(url: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(body: unknown) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : { error: "Network error" };
    setBusy(false);
    if (res?.ok) {
      setDirty(false);
      setMsg({ ok: true, text: "Saved ✓" });
      router.refresh();
    } else setMsg({ ok: false, text: data.error ?? "Could not save" });
  }
  return { busy, msg, save, dirty, touch: () => setDirty(true) };
}

export function Header({ title, sub, saver, onSave, extra }: { title: string; sub?: React.ReactNode; saver: ReturnType<typeof useSaver>; onSave: () => void; extra?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[#f5f6f5]/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      <div className="flex items-center gap-3">
        {extra}
        {saver.msg && <span className={`text-sm ${saver.msg.ok ? "text-brand-600" : "text-sale"}`}>{saver.msg.text}</span>}
        {saver.dirty && !saver.msg && <span className="text-xs text-muted">Unsaved changes</span>}
        <button onClick={onSave} disabled={saver.busy} className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">{saver.busy ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
}

export function Card({ title, sub, children, actions }: { title?: string; sub?: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {sub && <p className="text-xs text-muted">{sub}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

type Found = { sku: string; slug: string; name: string; brand: string; variant?: string; price: number; image?: string; inStock: boolean };

/** Search the catalog and pick products (by SKU or by item slug). */
export function ProductPicker({ label, hint, value, onChange, by = "sku", max = 50 }: { label: string; hint?: React.ReactNode; value: string[]; onChange: (v: string[]) => void; by?: "sku" | "slug"; max?: number }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [chosen, setChosen] = useState<Found[]>([]);
  useEffect(() => {
    if (!value.length) return setChosen([]);
    fetch(`/api/admin/lookup/?${by === "sku" ? "skus" : "slugs"}=${encodeURIComponent(value.join(","))}`).then((r) => r.json()).then((list: Found[]) =>
      setChosen(value.map((v) => list.find((p) => (by === "sku" ? p.sku.toLowerCase() === v.toLowerCase() : p.slug === v))).filter((x): x is Found => !!x)),
    ).catch(() => {});
  }, [value.join(","), by]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const t = setTimeout(() => fetch(`/api/admin/lookup/?q=${encodeURIComponent(q)}`).then((r) => r.json()).then(setFound).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);
  const key = (p: Found) => (by === "sku" ? p.sku : p.slug);
  return (
    <div className="text-sm">
      <p className="mb-1 font-medium">{label}</p>
      <div className="space-y-1">
        {value.map((v) => {
          const p = chosen.find((c) => (by === "sku" ? c.sku.toLowerCase() === v.toLowerCase() : c.slug === v));
          return (
            <div key={v} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p?.image ? <img src={imgUrl(p.image, 64)} alt="" className="h-8 w-8 rounded object-contain" /> : <span className="h-8 w-8 rounded bg-brand-50" />}
              <span className="flex-1 truncate">{p ? `${p.brand} · ${p.name}${p.variant ? ` · ${p.variant}` : ""}` : v}{p && !p.inStock && <span className="ml-1 text-xs text-sale">(sold out)</span>}</span>
              <span className="font-mono text-[10px] text-muted">{v}</span>
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="px-1 text-sale">✕</button>
            </div>
          );
        })}
      </div>
      {value.length < max && (
        <div className="relative mt-1">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products to add…" className={inputCls} />
          {found.length > 0 && (
            <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-white shadow-lg">
              {found.map((p) => (
                <button type="button" key={p.sku} onClick={() => { if (!value.includes(key(p))) onChange([...value, key(p)]); setQ(""); setFound([]); }} className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-brand-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.image ? <img src={imgUrl(p.image, 64)} alt="" className="h-8 w-8 rounded object-contain" /> : <span className="h-8 w-8 rounded bg-brand-50" />}
                  <span className="flex-1 truncate">{p.brand} · {p.name}{p.variant ? ` · ${p.variant}` : ""}</span>
                  <span className="text-xs">${p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Search the catalog and use a product's photo (and link) for a card. */
export function CatalogPick({ onPick }: { onPick: (image: string, href: string, name: string) => void }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const t = setTimeout(() => fetch(`/api/admin/lookup/?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((l: Found[]) => setFound(l.filter((p) => p.image))).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="relative text-sm">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Use a product photo from the catalog…" className={inputCls} />
      {found.length > 0 && (
        <div className="absolute z-30 mt-1 grid max-h-72 w-full grid-cols-4 gap-1 overflow-y-auto rounded-lg border border-line bg-white p-1 shadow-lg">
          {found.map((p) => (
            <button type="button" key={p.sku} title={`${p.brand} · ${p.name}`} onClick={() => { onPick(p.image!, `/products/${p.slug}/`, p.name); setQ(""); setFound([]); }} className="rounded border border-transparent p-1 hover:border-brand-500">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl(p.image!, 160)} alt="" className="aspect-square w-full object-contain" />
              <span className="line-clamp-2 text-[10px] leading-tight">{p.brand} · {p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
