"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { imgUrl } from "@/lib/img";
import { toCsv } from "@/lib/product-input";

type S = { slug: string; ours: string; oursImage?: string; theirs: string; theirsUrl: string; score: number; images: string[]; already?: string };

export function PhotoMatcher() {
  const router = useRouter();
  const [source, setSource] = useState("feel22.com");
  const [level, setLevel] = useState("0.75");
  const [busy, setBusy] = useState<"" | "finding" | "applying">("");
  const [pages, setPages] = useState(0);
  const [found, setFound] = useState<S[] | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [skipDone, setSkipDone] = useState(true);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  async function find() {
    setBusy("finding");
    setMsg(null);
    setFound(null);
    setExcluded(new Set());
    const best = new Map<string, S>();
    for (let page = 1; page <= 400; page++) {
      const res = await fetch("/api/admin/photo-match/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, page, minScore: Number(level) }) });
      const d = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
      if (!res.ok) { setMsg({ ok: false, text: d.error }); break; }
      setSourceName(d.sourceName);
      for (const s of d.suggestions as S[]) { const p = best.get(s.slug); if (!p || s.score > p.score) best.set(s.slug, s); }
      setPages(page);
      setFound([...best.values()]);
      if (d.done) break;
    }
    setBusy("");
  }

  const list = (found ?? []).filter((s) => !(skipDone && s.already)).sort((a, b) => b.score - a.score);
  const chosen = list.filter((s) => !excluded.has(s.slug));

  async function apply() {
    if (!window.confirm(`Replace the photos of ${chosen.length.toLocaleString("en-US")} products with ${sourceName}'s photos?`)) return;
    setBusy("applying");
    let done = 0;
    for (let i = 0; i < chosen.length; i += 200) {
      const items = chosen.slice(i, i + 200).map((s) => ({ slug: s.slug, images: s.images }));
      const res = await fetch("/api/admin/photo-match/apply/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceName, items }) });
      if (!res.ok) { setMsg({ ok: false, text: "Some updates failed — run it again to finish." }); break; }
      done += items.length;
      setMsg({ ok: true, text: `Updated ${done.toLocaleString("en-US")} of ${chosen.length.toLocaleString("en-US")}…` });
    }
    setMsg({ ok: true, text: `Done — ${done.toLocaleString("en-US")} products now use ${sourceName} photos. They keep them when you re-import prices.` });
    setBusy("");
    setFound((f) => (f ?? []).map((s) => (chosen.some((c) => c.slug === s.slug) ? { ...s, already: sourceName } : s)));
    router.refresh();
  }

  const downloadCsv = () => {
    const csv = toCsv([["superyou_item", "match", "match_url", "confidence", "photos"], ...list.map((s) => [s.ours, s.theirs, s.theirsUrl, String(s.score), String(s.images.length)])]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `photo-matches-${sourceName || "source"}.csv`;
    a.click();
  };

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Use photos from another store</h2>
      <p className="mt-1 text-sm text-muted">
        Finds the same products in a store you have permission from (matched by brand, name and size) and uses its photos instead. Items sold in several shades keep their own shade photos.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted">Photo source store</span>
          <input value={source} onChange={(e) => setSource(e.target.value)} className="w-56 rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-500" disabled={!!busy} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted">Match strictness</span>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-lg border border-line px-3 py-2" disabled={!!busy}>
            <option value="0.75">Strong matches only (recommended)</option>
            <option value="0.6">Include likely matches (review the list)</option>
          </select>
        </label>
        <button onClick={find} disabled={!!busy || !source.trim()} className="rounded-lg bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          {busy === "finding" ? `Matching… page ${pages}` : "Find matches"}
        </button>
      </div>

      {found && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span><b>{list.length.toLocaleString("en-US")}</b> products matched{excluded.size ? ` · ${excluded.size} unticked` : ""}</span>
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={skipDone} onChange={(e) => setSkipDone(e.target.checked)} /> Hide items already using these photos</label>
            <button onClick={downloadCsv} className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-brand-50">Download list (CSV)</button>
            <button onClick={apply} disabled={!!busy || !chosen.length} className="ml-auto rounded-lg bg-ink px-5 py-2 font-semibold text-white disabled:opacity-40">
              {busy === "applying" ? "Applying…" : `Use their photos for ${chosen.length.toLocaleString("en-US")} products`}
            </button>
          </div>
          {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-brand-600" : "text-sale"}`}>{msg.text}</p>}
          <div className="mt-3 max-h-[480px] overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white text-left text-muted"><tr><th className="p-2"></th><th className="p-2">Now</th><th className="p-2">Your product</th><th className="p-2">New photo</th><th className="p-2">Their product</th><th className="p-2 text-right">Match</th></tr></thead>
              <tbody className="divide-y divide-line">
                {list.slice(0, 300).map((s) => (
                  <tr key={s.slug} className={excluded.has(s.slug) ? "opacity-40" : ""}>
                    <td className="p-2"><input type="checkbox" checked={!excluded.has(s.slug)} onChange={() => setExcluded((e) => { const n = new Set(e); n.has(s.slug) ? n.delete(s.slug) : n.add(s.slug); return n; })} /></td>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <td className="p-2">{s.oursImage ? <img src={imgUrl(s.oursImage, 96)} alt="" className="h-12 w-12 rounded border border-line object-contain" /> : <span className="text-muted">none</span>}</td>
                    <td className="p-2">{s.ours}</td>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <td className="p-2"><img src={imgUrl(s.images[0], 96)} alt="" className="h-12 w-12 rounded border border-line object-contain" /></td>
                    <td className="p-2"><a href={s.theirsUrl} target="_blank" rel="noreferrer" className="hover:underline">{s.theirs}</a></td>
                    <td className={`p-2 text-right font-semibold ${s.score >= 0.75 ? "text-emerald-700" : "text-amber-600"}`}>{Math.round(s.score * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length > 300 && <p className="p-2 text-center text-xs text-muted">Showing the first 300 — download the list to see all.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
