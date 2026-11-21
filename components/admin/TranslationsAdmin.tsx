"use client";

import { useEffect, useState } from "react";
import { Card } from "./fields";

type Item = { id: string; source: string; text: string };

export function TranslationsAdmin({ aiReady }: { aiReady: boolean }) {
  const [lang, setLang] = useState<"fr" | "ar">("fr");
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState({ fr: 0, ar: 0 });
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [run, setRun] = useState("");

  async function load() {
    const r = await fetch(`/api/admin/translations/?lang=${lang}`).then((x) => x.json()).catch(() => null);
    if (r) (setItems(r.items ?? []), setCounts(r.counts ?? { fr: 0, ar: 0 }));
  }
  useEffect(() => { load(); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  async function translateStore() {
    setRun("Translating menus, homepage, categories, pages, services…");
    const r = await fetch("/api/admin/translations/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, part: "store" }) }).then((x) => x.json()).catch(() => ({ error: "Failed" }));
    setRun(r.error ? `⚠ ${r.error}` : `✓ ${r.translated} of ${r.total} texts translated.`);
    load();
  }
  async function translateProducts() {
    let offset = 0;
    for (;;) {
      const r = await fetch("/api/admin/translations/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, part: "products", offset }) }).then((x) => x.json()).catch(() => ({ error: "Failed" }));
      if (r.error) return setRun(`⚠ ${r.error} (stopped at ${offset})`);
      offset = r.next;
      setRun(`Product descriptions: ${offset.toLocaleString()} / ${r.total.toLocaleString()}… (you can leave this page open; closing it just pauses)`);
      if (r.done) break;
    }
    setRun("✓ All product descriptions translated.");
    load();
  }
  async function save(it: Item) {
    const text = edit[it.id];
    if (!text) return;
    await fetch("/api/admin/translations/", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, source: it.source, text }) });
    setItems((l) => l.map((x) => (x.id === it.id ? { ...x, text } : x)));
    setEdit(({ [it.id]: _, ...rest }) => rest);
  }
  const shown = items.filter((i) => !q || i.source.toLowerCase().includes(q.toLowerCase()) || i.text.toLowerCase().includes(q.toLowerCase())).slice(0, 300);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Translations</h1>
        <p className="text-sm text-muted">The shop speaks English (default), French (/fr/) and Arabic (/ar/). Buttons and messages are translated already. Your own content — menus, banners, pages, categories, product descriptions — is translated by AI the first time someone views it, then saved. Correct anything here.</p>
      </div>
      {!aiReady && <p className="rounded-xl bg-amber-50 p-4 text-sm">Automatic translation is off: add <b>ANTHROPIC_API_KEY</b> in Vercel → Settings → Environment Variables and redeploy. Until then your own content shows in English on the French and Arabic pages.</p>}
      <div className="flex flex-wrap items-center gap-2">
        {(["fr", "ar"] as const).map((l) => (
          <button key={l} onClick={() => setLang(l)} className={`rounded-full px-4 py-1.5 text-sm ${lang === l ? "bg-ink text-white" : "bg-white"}`}>{l === "fr" ? "Français" : "العربية"} ({counts[l].toLocaleString()})</button>
        ))}
      </div>
      <Card title="Translate everything now" sub="Optional: the shop translates by itself as pages are visited. Doing it now means the first visitors already see everything translated.">
        <div className="flex flex-wrap gap-2">
          <button disabled={!aiReady} onClick={translateStore} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">1. Menus, homepage, categories, pages</button>
          <button disabled={!aiReady} onClick={translateProducts} className="rounded-lg border border-ink px-4 py-2 text-sm font-semibold disabled:opacity-40">2. All product descriptions (takes a while)</button>
        </div>
        {run && <p className="mt-3 text-sm">{run}</p>}
      </Card>
      <Card title="Saved translations" sub="Search, then edit and save. Your version replaces the automatic one everywhere.">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="mb-3 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        <ul className="divide-y divide-line">
          {shown.map((it) => (
            <li key={it.id} className="grid gap-2 py-3 md:grid-cols-2">
              <p className="line-clamp-4 text-sm text-muted">{it.source}</p>
              <div className="flex gap-2">
                <textarea dir={lang === "ar" ? "rtl" : "ltr"} rows={2} value={edit[it.id] ?? it.text} onChange={(e) => setEdit({ ...edit, [it.id]: e.target.value })} className="flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
                {edit[it.id] !== undefined && <button onClick={() => save(it)} className="self-start rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">Save</button>}
              </div>
            </li>
          ))}
          {shown.length === 0 && <li className="py-6 text-sm text-muted">Nothing translated yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
