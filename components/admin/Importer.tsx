"use client";

import Papa from "papaparse";
import readXlsxFile from "read-excel-file/browser";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { guessMapping, importFields, toCsv } from "@/lib/product-input";

type Sheet = { name: string; rows: string[][] };
type Report = { created: number; updated: number; deleted: number; errors: { row: number; sku?: string; errors: string[] }[] };

const CHUNK = 250;

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
};

export function Importer({ existing }: { existing: { id: string; sku: string }[] }) {
  const router = useRouter();
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [asDraft, setAsDraft] = useState(false);
  const [replace, setReplace] = useState(false);
  const [parseError, setParseError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [dragging, setDragging] = useState(false);

  const sheet = sheets[sheetIdx];
  const headers = sheet?.rows[headerRow] ?? [];
  const dataRows = useMemo(() => (sheet ? sheet.rows.slice(headerRow + 1).filter((r) => r.some((c) => c !== "")) : []), [sheet, headerRow]);
  const existingSkus = useMemo(() => new Map(existing.map((e) => [e.sku.toLowerCase(), e.id])), [existing]);

  function pickSheet(list: Sheet[], idx: number) {
    setSheets(list);
    setSheetIdx(idx);
    const rows = list[idx]?.rows ?? [];
    const h = Math.max(0, rows.findIndex((r) => r.filter(Boolean).length >= 2));
    setHeaderRow(h);
    setMapping(guessMapping(rows[h] ?? []));
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setParseError("");
    setReport(null);
    setFileName(file.name);
    try {
      if (/\.(csv|txt|tsv)$/i.test(file.name)) {
        const text = await file.text();
        const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
        pickSheet([{ name: file.name, rows: parsed.data.map((r) => r.map(cell)) }], 0);
      } else if (/\.xlsx$/i.test(file.name)) {
        const all = await readXlsxFile(file);
        pickSheet(all.map((s) => ({ name: s.sheet, rows: s.data.map((r) => r.map(cell)) })), 0);
      } else {
        setParseError("Use a .csv or .xlsx file. Old .xls files: open in Excel and “Save as” .xlsx or .csv first.");
      }
    } catch (e) {
      setParseError(`Couldn't read that file: ${(e as Error).message}`);
    }
  }

  // Build the objects we send to the server, plus quick client-side checks.
  const mapped = useMemo(() => {
    const firstRowForSku = new Map<string, number>();
    return dataRows.map((r, i) => {
      const o: Record<string, string | number> = { _row: headerRow + i + 2 };
      for (const f of importFields) {
        const idx = mapping[f.key];
        if (idx !== null && idx !== undefined) o[f.key] = r[idx] ?? "";
      }
      if (asDraft && (mapping.status === null || mapping.status === undefined)) o.status = "draft";
      const problems: string[] = [];
      const skuKey = String(o.sku ?? "").toLowerCase();
      if (!o.sku) problems.push("missing SKU");
      else if (firstRowForSku.has(skuKey)) problems.push(`duplicate SKU (row ${firstRowForSku.get(skuKey)})`);
      else firstRowForSku.set(skuKey, Number(o._row));
      if (!o.name) problems.push("missing name");
      if (o.price === undefined || o.price === "" || Number.isNaN(Number(String(o.price).replace(/[$,\s]/g, "")))) problems.push("price isn't a number");
      return { data: o, problems, isNew: !existingSkus.has(String(o.sku ?? "").toLowerCase()) };
    });
  }, [dataRows, mapping, asDraft, headerRow, existingSkus]);

  const valid = mapped.filter((m) => !m.problems.length);
  const invalid = mapped.length - valid.length;
  const newCount = valid.filter((m) => m.isNew).length;
  const missingRequired = importFields.filter((f) => f.required && (mapping[f.key] === null || mapping[f.key] === undefined));
  const toDelete = useMemo(() => {
    if (!replace) return [];
    const inFile = new Set(valid.map((m) => String(m.data.sku).toLowerCase()));
    return existing.filter((e) => !inFile.has(e.sku.toLowerCase()));
  }, [replace, valid, existing]);

  async function run() {
    if (replace && toDelete.length && !window.confirm(`${toDelete.length} product(s) that aren't in this file will be deleted. Continue?`)) return;
    const rep: Report = { created: 0, updated: 0, deleted: 0, errors: mapped.filter((m) => m.problems.length).map((m) => ({ row: Number(m.data._row), sku: String(m.data.sku ?? ""), errors: m.problems })) };
    setProgress(0);
    for (let i = 0; i < valid.length; i += CHUNK) {
      const rows = valid.slice(i, i + CHUNK).map((m) => m.data);
      const res = await fetch("/api/admin/import/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const data = await res.json().catch(() => ({ error: "Server error" }));
      if (!res.ok) {
        rep.errors.push({ row: Number(rows[0]._row), errors: [`batch failed: ${data.error}`] });
      } else {
        rep.created += data.created;
        rep.updated += data.updated;
        rep.errors.push(...data.errors);
      }
      setProgress(Math.min(1, (i + CHUNK) / valid.length));
    }
    if (replace && toDelete.length) {
      for (let i = 0; i < toDelete.length; i += 500) {
        const ids = toDelete.slice(i, i + 500).map((e) => e.id);
        await fetch("/api/admin/products/", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", ids }) });
        rep.deleted += ids.length;
      }
    }
    setProgress(null);
    setReport(rep);
    router.refresh();
  }

  const downloadErrors = () => {
    if (!report) return;
    const csv = toCsv([["row", "sku", "problem"], ...report.errors.map((e) => [String(e.row), e.sku ?? "", e.errors.join("; ")])]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "import-errors.csv";
    a.click();
  };

  const card = "rounded-xl bg-white p-5 shadow-sm";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Import / export products</h1>
        <div className="flex gap-2 text-sm">
          <a href="/api/admin/template/" className="rounded-lg border border-line bg-white px-4 py-2 font-semibold hover:bg-brand-50">Download template</a>
          <a href="/api/admin/export/" className="rounded-lg border border-line bg-white px-4 py-2 font-semibold hover:bg-brand-50">Export all products (CSV)</a>
        </div>
      </div>

      {/* Step 1 — file */}
      <section className={card}>
        <h2 className="font-semibold">1. Choose a file</h2>
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files[0]); }}
          className={`mt-3 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed p-8 text-center ${dragging ? "border-brand-500 bg-brand-50" : "border-line"}`}
        >
          <span className="font-medium">{fileName || "Drop a CSV or Excel (.xlsx) file here, or click to browse"}</span>
          <span className="mt-1 text-xs text-muted">First row with column names is detected automatically. Up to tens of thousands of rows.</span>
          <input type="file" accept=".csv,.tsv,.txt,.xlsx" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {parseError && <p className="mt-3 text-sm text-sale">{parseError}</p>}
        {sheets.length > 1 && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            Sheet:
            <select value={sheetIdx} onChange={(e) => pickSheet(sheets, Number(e.target.value))} className="rounded-lg border border-line px-2 py-1">
              {sheets.map((s, i) => <option key={s.name} value={i}>{s.name} ({s.rows.length} rows)</option>)}
            </select>
          </div>
        )}
        {sheet && (
          <p className="mt-3 text-sm text-muted">
            Found <b className="text-ink">{dataRows.length}</b> product rows. Column names are on row{" "}
            <input type="number" min={1} value={headerRow + 1} onChange={(e) => { const h = Math.max(0, Number(e.target.value) - 1); setHeaderRow(h); setMapping(guessMapping(sheet.rows[h] ?? [])); }} className="w-14 rounded border border-line px-1" />.
          </p>
        )}
      </section>

      {/* Step 2 — mapping */}
      {sheet && (
        <section className={card}>
          <h2 className="font-semibold">2. Match your columns</h2>
          <p className="mt-1 text-sm text-muted">We guessed from your column names. Fix anything that's wrong; leave a field on “skip” to keep its current value on existing products.</p>
          <div className="mt-4 grid gap-x-6 gap-y-3 md:grid-cols-2">
            {importFields.map((f) => {
              const idx = mapping[f.key];
              const sample = idx !== null && idx !== undefined ? dataRows[0]?.[idx] : "";
              return (
                <div key={f.key} className="grid grid-cols-[130px_1fr] items-center gap-2 text-sm">
                  <span className="font-medium">
                    {f.label}{f.required && <span className="text-sale"> *</span>}
                    {f.hint && <span className="block text-[11px] font-normal text-muted">{f.hint}</span>}
                  </span>
                  <div>
                    <select
                      value={idx ?? ""}
                      onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === "" ? null : Number(e.target.value) })}
                      className={`w-full rounded-lg border px-2 py-1.5 ${f.required && (idx === null || idx === undefined) ? "border-sale" : "border-line"}`}
                    >
                      <option value="">— skip —</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                    </select>
                    {sample && <span className="mt-0.5 block truncate text-[11px] text-muted">e.g. {sample}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={asDraft} onChange={(e) => setAsDraft(e.target.checked)} disabled={mapping.status !== null && mapping.status !== undefined} />
              Import new products as drafts (hidden until you publish them)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              <span>Full sync: <b>delete</b> products that aren't in this file</span>
            </label>
          </div>
        </section>
      )}

      {/* Step 3 — preview & import */}
      {sheet && dataRows.length > 0 && (
        <section className={card}>
          <h2 className="font-semibold">3. Check and import</h2>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <span className="rounded-lg bg-brand-50 px-3 py-1.5 text-brand-700"><b>{newCount}</b> new</span>
            <span className="rounded-lg bg-[#eef3fb] px-3 py-1.5 text-[#2b5a9e]"><b>{valid.length - newCount}</b> will update (same SKU)</span>
            {invalid > 0 && <span className="rounded-lg bg-red-50 px-3 py-1.5 text-sale"><b>{invalid}</b> with problems (skipped)</span>}
            {replace && <span className="rounded-lg bg-red-50 px-3 py-1.5 text-sale"><b>{toDelete.length}</b> will be deleted</span>}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="text-left text-muted">
                <tr><th className="p-2">Row</th><th className="p-2">SKU</th><th className="p-2">Name</th><th className="p-2">Brand</th><th className="p-2">Category</th><th className="p-2 text-right">Price</th><th className="p-2"></th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {mapped.slice(0, 15).map((m) => (
                  <tr key={String(m.data._row)} className={m.problems.length ? "bg-red-50" : ""}>
                    <td className="p-2 text-muted">{m.data._row}</td>
                    <td className="p-2 font-mono">{m.data.sku}</td>
                    <td className="p-2">{m.data.name}</td>
                    <td className="p-2">{m.data.brand}</td>
                    <td className="p-2">{m.data.category}</td>
                    <td className="p-2 text-right">{m.data.price}</td>
                    <td className="p-2">{m.problems.length ? <span className="text-sale">{m.problems.join(", ")}</span> : m.isNew ? <span className="text-brand-600">new</span> : <span className="text-[#2b5a9e]">update</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mapped.length > 15 && <p className="mt-2 text-xs text-muted">…and {mapped.length - 15} more rows.</p>}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              onClick={run}
              disabled={progress !== null || missingRequired.length > 0 || valid.length === 0}
              className="rounded-lg bg-brand-500 px-6 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {progress !== null ? `Importing… ${Math.round(progress * 100)}%` : `Import ${valid.length} products`}
            </button>
            {missingRequired.length > 0 && <span className="text-sm text-sale">Match a column for: {missingRequired.map((f) => f.label).join(", ")}</span>}
          </div>
          {progress !== null && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-brand-500 transition-all" style={{ width: `${progress * 100}%` }} /></div>
          )}
        </section>
      )}

      {report && (
        <section className={`${card} border-l-4 ${report.errors.length ? "border-amber-400" : "border-brand-500"}`}>
          <h2 className="font-semibold">Import finished</h2>
          <p className="mt-2 text-sm">
            <b>{report.created}</b> created · <b>{report.updated}</b> updated
            {report.deleted > 0 && <> · <b>{report.deleted}</b> deleted</>}
            {report.errors.length > 0 && <> · <b className="text-sale">{report.errors.length}</b> rows skipped</>}
          </p>
          {report.errors.length > 0 && (
            <>
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-sale">
                {report.errors.slice(0, 50).map((e, i) => <li key={i}>Row {e.row}{e.sku ? ` (${e.sku})` : ""}: {e.errors.join("; ")}</li>)}
              </ul>
              <button onClick={downloadErrors} className="mt-3 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-brand-50">Download error list (CSV)</button>
            </>
          )}
          <a href="/admin/products/" className="mt-3 block text-sm font-semibold text-brand-600 hover:underline">Go to products →</a>
        </section>
      )}
    </div>
  );
}
