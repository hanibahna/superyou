"use client";

import { useEffect, useState } from "react";
import type { Report } from "@/lib/price-match";

type Data = { report: Report | null; running: { site: number; page: number; startedAt: string } | null };

const money = (n: number) => `$${n.toFixed(2)}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Beirut" });

/** Last nightly price check, and a button to run one now. */
export function PriceMatchReport() {
  const [d, setD] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => fetch("/api/admin/price-match/").then((r) => r.json()).then(setD).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);
  const run = async () => {
    setBusy(true);
    await fetch("/api/admin/price-match/", { method: "POST" }).catch(() => {});
    setTimeout(() => (setBusy(false), load()), 4000);
  };
  const r = d?.report;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} disabled={busy || !!d?.running} className="rounded-full bg-ink px-4 py-2 font-semibold text-white disabled:opacity-50">
          {d?.running ? "Checking prices…" : busy ? "Starting…" : "Check prices now"}
        </button>
        <span className="text-muted">{d?.running ? `Shop ${d.running.site + 1}, page ${d.running.page}. Takes a few minutes; you can leave this page.` : r ? `Last check: ${when(r.at)}` : "No check yet. It also runs every night at 3 am."}</span>
      </div>
      {r && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat n={r.matched} label="our products found at a competitor" />
            <Stat n={r.cheaper} label="cheaper there than here" />
            <Stat n={r.matchedNow} label="price matched now" />
          </div>
          <table className="w-full text-left">
            <thead className="text-xs uppercase text-muted"><tr><th className="py-1">Shop</th><th>Products read</th><th>Matched to ours</th><th>Exact (barcode or same item)</th><th>Status</th></tr></thead>
            <tbody>
              {r.sites.map((s) => (
                <tr key={s.domain} className="border-t border-line">
                  <td className="py-1.5 font-medium">{s.label}</td><td>{s.products.toLocaleString()}</td><td>{s.matched.toLocaleString()}</td><td>{s.byBarcode.toLocaleString()}</td>
                  <td className={s.error ? "text-sale" : "text-[#046c4e]"}>{s.error ? `Skipped: ${s.error}` : "OK"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.flags.length > 0 && (
            <div>
              <p className="font-semibold">Cheaper elsewhere but not matched ({r.flags.length})</p>
              <p className="text-xs text-muted">Below floor: matching would go under cost + margin. No cost: add the product's cost to allow matching. Check match: the price gap is so large it may be a different size.</p>
              <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white uppercase text-muted"><tr><th className="p-2">Product</th><th>Ours</th><th>Theirs</th><th>Floor</th><th>Why</th></tr></thead>
                  <tbody>
                    {r.flags.map((f) => (
                      <tr key={f.id} className="border-t border-line">
                        <td className="p-2">{f.name}<a href={f.url} target="_blank" rel="noreferrer" className="ml-1 text-brand-600 underline">{f.site}</a></td>
                        <td>{money(f.ours)}</td><td>{money(f.theirs)}</td><td>{f.floor ? money(f.floor) : "—"}</td><td>{f.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <p className="text-2xl font-bold">{n.toLocaleString()}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
