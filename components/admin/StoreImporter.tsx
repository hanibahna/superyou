"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Totals = { pages: number; fetched: number; rows: number; created: number; updated: number; errors: number; removed: number; categories: Record<string, number> };
const empty: Totals = { pages: 0, fetched: 0, rows: 0, created: 0, updated: 0, errors: 0, removed: 0, categories: {} };

const prefixFor = (host: string) =>
  (host.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[./]/)[0] || "SRC").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "SRC";

export function StoreImporter() {
  const router = useRouter();
  const [source, setSource] = useState("neovitale.com");
  const [adjust, setAdjust] = useState("0");
  const [round, setRound] = useState<"cents" | "quarter">("cents");
  const [asDraft, setAsDraft] = useState(false);
  const [skipDup, setSkipDup] = useState(true);
  const [sync, setSync] = useState(true);
  const [running, setRunning] = useState(false);
  const [stop, setStop] = useState(false);
  const [t, setT] = useState<Totals | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errs, setErrs] = useState<string[]>([]);

  async function run() {
    setRunning(true);
    setStop(false);
    setMsg(null);
    setErrs([]);
    const totals: Totals = { ...empty, categories: {} };
    const seen: string[] = [];
    let sourceName = "";
    let ok = true;
    for (let page = 1; page <= 400; page++) {
      if ((window as unknown as { __stopImport?: boolean }).__stopImport) { ok = false; break; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await fetch("/api/admin/import-store/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, page, adjustPct: Number(adjust) || 0, round, asDraft, skipDuplicates: skipDup, skuPrefix: prefixFor(source) }),
        });
        data = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
        if (res.ok) break;
        if (attempt === 3 || res.status < 500) { setMsg({ ok: false, text: data.error ?? "Import failed" }); ok = false; }
        else await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
      if (!ok) break;
      sourceName = data.sourceName ?? sourceName;
      totals.pages = page;
      totals.fetched += data.fetched;
      totals.rows += data.rows;
      totals.created += data.created;
      totals.updated += data.updated;
      totals.errors += data.errorCount ?? 0;
      for (const [k, v] of Object.entries(data.categories as Record<string, number>)) totals.categories[k] = (totals.categories[k] ?? 0) + v;
      seen.push(...data.skus);
      if (data.errors?.length) setErrs((e) => [...e, ...data.errors.map((x: { sku?: string; errors: string[] }) => `${x.sku}: ${x.errors.join("; ")}`)].slice(0, 30));
      setT({ ...totals, categories: { ...totals.categories } });
      if (data.done) break;
    }
    if (ok && sync && seen.length && sourceName) {
      const res = await fetch("/api/admin/import-store/finish/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceName, keepSkus: seen }) });
      const d = await res.json().catch(() => ({}));
      totals.removed = d.removed ?? 0;
      setT({ ...totals });
    }
    if (ok) setMsg({ ok: true, text: `Done — ${totals.fetched.toLocaleString("en-US")} products (${totals.rows.toLocaleString("en-US")} sizes/shades) imported.` });
    setRunning(false);
    (window as unknown as { __stopImport?: boolean }).__stopImport = false;
    router.refresh();
  }

  const input = "rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500";
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Import from another online store</h2>
      <p className="mt-1 text-sm text-muted">
        Copies the full catalog of a Shopify store you have permission to use — products, sizes/shades, prices, availability, photos and descriptions — and sorts them into your categories.
        Run it again any time to refresh prices and stock.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">Store address</span>
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="neovitale.com" className={`${input} w-full`} disabled={running} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">Price adjustment (%)</span>
          <input value={adjust} onChange={(e) => setAdjust(e.target.value)} inputMode="decimal" className={`${input} w-full`} disabled={running} />
          <span className="mt-0.5 block text-[11px] text-muted">−5 = 5% below their price · 0 = same price</span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">Rounding</span>
          <select value={round} onChange={(e) => setRound(e.target.value as "cents" | "quarter")} className={`${input} w-full`} disabled={running}>
            <option value="cents">To the cent ($12.37)</option>
            <option value="quarter">To the quarter ($12.25)</option>
          </select>
        </label>
      </div>
      <div className="mt-3 space-y-1.5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={asDraft} onChange={(e) => setAsDraft(e.target.checked)} disabled={running} /> Import as drafts (hidden until you publish them)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} disabled={running} /> Skip products we already sell from another catalog (same barcode, or same brand, name and size)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} disabled={running} /> Remove products the store no longer sells (from earlier imports of this store)</label>
      </div>
      <p className="mt-2 text-xs text-muted">SKUs are created as <b>{prefixFor(source)}-</b>&lt;their variant number&gt;, so re-running updates the same products instead of duplicating them.</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={running || !source.trim()} className="rounded-lg bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          {running ? "Importing…" : "Start import"}
        </button>
        {running && (
          <button onClick={() => { (window as unknown as { __stopImport?: boolean }).__stopImport = true; setStop(true); }} className="rounded-lg border border-line px-4 py-2 text-sm">
            {stop ? "Stopping after this page…" : "Stop"}
          </button>
        )}
        {msg && <span className={`text-sm ${msg.ok ? "text-brand-600" : "text-sale"}`}>{msg.text}</span>}
      </div>

      {t && (
        <div className="mt-4 rounded-lg bg-[#f7f8f7] p-4 text-sm">
          <p>
            Page <b>{t.pages}</b> · <b>{t.fetched.toLocaleString("en-US")}</b> products · <b>{t.rows.toLocaleString("en-US")}</b> sizes/shades ·{" "}
            <b>{t.created.toLocaleString("en-US")}</b> new · <b>{t.updated.toLocaleString("en-US")}</b> updated
            {t.removed > 0 && <> · <b>{t.removed}</b> removed</>}
            {t.errors > 0 && <> · <b className="text-sale">{t.errors}</b> skipped</>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(t.categories).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <span key={k} className="rounded-full bg-white px-2.5 py-0.5 text-xs">{k} <b>{v.toLocaleString("en-US")}</b></span>
            ))}
          </div>
          {errs.length > 0 && <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-sale">{errs.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        </div>
      )}
      <ImageCopier />
    </section>
  );
}

function ImageCopier() {
  const [running, setRunning] = useState(false);
  const [state, setState] = useState<{ copied: number; failed: number; remaining: number } | null>(null);
  const [err, setErr] = useState("");
  const [mainOnly, setMainOnly] = useState(true);

  async function run() {
    setRunning(true);
    setErr("");
    let skip = 0, copied = 0, failed = 0;
    for (let i = 0; i < 5000; i++) {
      if ((window as unknown as { __stopCopy?: boolean }).__stopCopy) break;
      const res = await fetch("/api/admin/rehost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skip, limit: 15, mainOnly }) });
      const d = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
      if (!res.ok) { setErr(d.error ?? "Failed"); break; }
      if (d.done) break;
      skip += d.failedProducts;
      copied += d.copied;
      failed += d.failed;
      setState({ copied, failed, remaining: d.remaining });
      if (d.remaining === 0) break;
    }
    (window as unknown as { __stopCopy?: boolean }).__stopCopy = false;
    setRunning(false);
  }

  return (
    <div className="mt-6 border-t border-line pt-4">
      <h3 className="text-sm font-semibold">Copy photos to your own storage (optional)</h3>
      <p className="mt-1 text-xs text-muted">
        Imported photos load from the source store's image server. Copy them into your Vercel Blob storage so they keep working even if the source removes a product.
        Main photo only ≈ 80 KB per product (about 0.7 GB for 9,000 products) — check your Blob plan's storage limit first.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={mainOnly} onChange={(e) => setMainOnly(e.target.checked)} disabled={running} /> Main photo only</label>
        <button onClick={run} disabled={running} className="rounded-lg border border-line px-4 py-2 font-semibold hover:bg-brand-50 disabled:opacity-50">{running ? "Copying…" : "Copy photos"}</button>
        {running && <button onClick={() => ((window as unknown as { __stopCopy?: boolean }).__stopCopy = true)} className="text-xs underline">Stop</button>}
        {state && <span className="text-xs text-muted">{state.copied.toLocaleString("en-US")} copied · {state.remaining.toLocaleString("en-US")} products left{state.failed ? ` · ${state.failed} failed` : ""}</span>}
        {err && <span className="text-xs text-sale">{err}</span>}
      </div>
    </div>
  );
}
