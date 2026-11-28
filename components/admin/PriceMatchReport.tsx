"use client";

import { useEffect, useState } from "react";
import type { Report } from "@/lib/price-match";

type Data = { report: Report | null; running: { site: number; page: number; startedAt: string; error?: string } | null };

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
  const run = async (resume = false) => {
    setBusy(true);
    await fetch("/api/admin/price-match/", { method: "POST", body: JSON.stringify({ resume }) }).catch(() => {});
    setTimeout(() => (setBusy(false), load()), 4000);
  };
  const r = d?.report;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => run()} disabled={busy || (!!d?.running && Date.now() - new Date(d.running.startedAt).getTime() < 20 * 60_000)} className="rounded-full bg-ink px-4 py-2 font-semibold text-white disabled:opacity-50">
          {d?.running ? "Checking prices…" : busy ? "Starting…" : "Check prices now"}
        </button>
        {d?.running && Date.now() - new Date(d.running.startedAt).getTime() > 10 * 60_000 && (
          <button type="button" onClick={() => run(true)} disabled={busy} className="rounded-full border border-line px-4 py-2 font-semibold">Continue the check</button>
        )}
        {d?.running?.error && <span className="text-sale">Last error: {d.running.error}</span>}
        <span className="text-muted">{d?.running ? `Shop ${d.running.site + 1}, page ${d.running.page}. Takes a few minutes; you can leave this page.` : r ? `Last check: ${when(r.at)}` : "No check yet. It also runs every night at 3 am."}</span>
      </div>
      {r && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat n={r.matched} label="our products found at a competitor" />
            <Stat n={r.cheaper} label="cheaper there than here" />
            <Stat n={r.matchedNow} label="on SuperPrice now" />
          </div>
          {r.avgMargin && r.matchedNow > 0 && (
            <p className="rounded-lg bg-[#fff5f8] p-3">
              Average margin on SuperPrice items: <b>{r.avgMargin.before}%</b> before → <b>{r.avgMargin.after}%</b> on SuperPrice.
              {!!r.estimated && <> {r.estimated.toLocaleString()} of them use the assumed margin because no cost is on file, so these margins are estimates.</>}
            </p>
          )}
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
          {!!r.superPrices?.length && (
            <div>
              <p className="font-semibold">On SuperPrice now (biggest drops first)</p>
              <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white uppercase text-muted"><tr><th className="p-2">Product</th><th>Was</th><th>Shop</th><th>SuperPrice</th><th>Cost</th><th>Margin</th></tr></thead>
                  <tbody>
                    {r.superPrices.map((m) => (
                      <tr key={m.id} className="border-t border-line">
                        <td className="p-2">{m.name}</td><td>{money(m.ours)}</td><td>{m.site} {money(m.theirs)}</td><td className="font-semibold">{money(m.superPrice)}</td>
                        <td>{money(m.cost)}{m.est ? " (est.)" : ""}</td><td>{m.margin}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {r.flags.length > 0 && (
            <div>
              <p className="font-semibold">Cheaper elsewhere but not matched ({r.flags.length})</p>
              <p className="text-xs text-muted">Below floor: they sell under our cost + margin (or our maximum discount). No cost: add the product's cost to allow matching. Check match: the price gap is so large it may be a different size.</p>
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
      <MatchQuality />
    </div>
  );
}

type Cov = { products: number; compared: number; exact: number; confirmed: number; name: number; stale: number; review: number };
type Rev = { key: string; id: string; ours: string; oursPrice: number; theirs: string; theirsPrice: number; site: string; url: string; c: number };
type Rec = { site: string; rec: { p: number; was?: number; u: string; how: string; c: number; first: string; seen: string; h: [string, number][] } };

/** How much of the catalogue we can compare, the matches waiting for a person, and one product's history. */
function MatchQuality() {
  const [cov, setCov] = useState<Cov | null>(null);
  const [items, setItems] = useState<Rev[]>([]);
  const [q, setQ] = useState("");
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const load = () => {
    fetch("/api/admin/price-match/?coverage=1").then((r) => r.json()).then(setCov).catch(() => {});
    fetch("/api/admin/price-match/?review=1").then((r) => r.json()).then((d) => setItems(d.items ?? [])).catch(() => {});
  };
  useEffect(load, []);
  const decide = async (key: string, ok: boolean) => {
    setItems((l) => l.filter((x) => x.key !== key));
    await fetch("/api/admin/price-match/", { method: "POST", body: JSON.stringify({ decide: { key, ok } }) }).catch(() => {});
  };
  const pct = (n: number) => (cov?.products ? Math.round((n / cov.products) * 100) : 0);
  return (
    <div className="space-y-4 border-t border-line pt-4">
      <p className="font-semibold">Matching quality</p>
      {cov && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat n={cov.compared} label={`of ${cov.products.toLocaleString()} products compared (${pct(cov.compared)}%)`} />
            <Stat n={cov.exact} label="exact: barcode or same item" />
            <Stat n={cov.confirmed + cov.name} label={`by name (${cov.confirmed} confirmed by you)`} />
            <Stat n={cov.review} label="waiting for your review" />
          </div>
          {cov.stale > 0 && <p className="text-xs text-muted">{cov.stale.toLocaleString()} matched products weren&apos;t seen at any shop in the last 7 days (sold out or removed there), so they aren&apos;t used.</p>}
        </>
      )}
      {items.length > 0 && (
        <div>
          <p className="font-semibold">Is it the same product? ({items.length})</p>
          <p className="text-xs text-muted">These matched by name only and aren&apos;t certain enough to change prices or claims. Your answer is used from the next price check (twice a day).</p>
          <div className="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white uppercase text-muted"><tr><th className="p-2">Ours</th><th>Theirs</th><th>Sure</th><th></th></tr></thead>
              <tbody>
                {items.map((x) => (
                  <tr key={x.key} className="border-t border-line align-top">
                    <td className="p-2">{x.ours}<br /><b>{money(x.oursPrice)}</b></td>
                    <td className="p-2">{x.theirs}<br /><b>{money(x.theirsPrice)}</b> <a href={x.url} target="_blank" rel="noreferrer" className="text-brand-600 underline">{x.site}</a></td>
                    <td className="p-2">{Math.round(x.c * 100)}%</td>
                    <td className="whitespace-nowrap p-2">
                      <button type="button" onClick={() => decide(x.key, true)} className="rounded-full bg-[#046c4e] px-3 py-1 font-semibold text-white">Same</button>{" "}
                      <button type="button" onClick={() => decide(x.key, false)} className="rounded-full border border-line px-3 py-1 font-semibold">Different</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) fetch(`/api/admin/price-match/?product=${encodeURIComponent(q.trim())}`).then((r) => r.json()).then((d) => setRecs(d.recs ?? [])).catch(() => setRecs([])); }} className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Product ID, to see its competitor prices and history" className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2" />
        <button className="rounded-full border border-line px-4 py-2 font-semibold">Look up</button>
      </form>
      {recs && (recs.length ? (
        <table className="w-full text-left text-xs">
          <thead className="uppercase text-muted"><tr><th className="py-1">Shop</th><th>Price</th><th>Match</th><th>Last seen</th><th>Price history</th></tr></thead>
          <tbody>
            {recs.map(({ site, rec }) => (
              <tr key={site} className="border-t border-line">
                <td className="py-1.5"><a href={rec.u} target="_blank" rel="noreferrer" className="underline">{site}</a></td>
                <td>{money(rec.p)}{rec.was ? <span className="ml-1 text-muted line-through">{money(rec.was)}</span> : null}</td>
                <td>{rec.how === "barcode" ? "exact" : rec.how === "confirmed" ? "confirmed" : `name ${Math.round(rec.c * 100)}%`}</td>
                <td>{when(rec.seen)}</td>
                <td>{rec.h.map(([d, p]) => `${d.slice(5)} ${money(p)}`).join(" → ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="text-xs text-muted">No competitor has this product on record.</p>)}
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
