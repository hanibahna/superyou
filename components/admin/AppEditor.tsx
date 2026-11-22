"use client";

import { useState } from "react";
import { Card, Text } from "./fields";

export function AppEditor({ hasKey, mask, stats, log }: { hasKey: boolean; mask: string; stats: { ios: number; android: number; total: number }; log: { at: string; title: string; sent: number; failed: number }[] }) {
  const [key, setKey] = useState(hasKey ? mask : "");
  const [msg, setMsg] = useState("");
  const [p, setP] = useState({ title: "", body: "", url: "/" });
  const [busy, setBusy] = useState(false);
  const post = async (body: unknown) => {
    setBusy(true);
    const r = await fetch("/api/admin/app/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json()).catch(() => ({ error: "Network error" }));
    setBusy(false);
    return r;
  };
  return (
    <div>
      <h1 className="text-2xl font-semibold">Mobile app</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">The SuperYou iOS and Android apps open the live shop, so products, prices and pages update in the apps the moment you change them here. This page sends push notifications to phones that installed the app.</p>
      <div className="mt-5 grid grid-cols-3 gap-3 md:max-w-xl">
        {[["Phones", stats.total], ["iPhone", stats.ios], ["Android", stats.android]].map(([l, v]) => (
          <div key={l} className="rounded-xl border border-line bg-white p-3"><p className="text-xs text-muted">{l}</p><p className="text-2xl font-bold">{v}</p></div>
        ))}
      </div>
      <div className="mt-5 space-y-5">
        <Card title="Send a push notification" sub="Goes to every phone with the app and notifications allowed. Keep it short: phones show about 40 characters of the title.">
          <div className="grid gap-3 md:grid-cols-2">
            <Text label="Title" value={p.title} placeholder="Black Friday: up to 70% off" onChange={(v) => setP({ ...p, title: v.slice(0, 65) })} />
            <Text label="Opens" hint="A page on the shop, e.g. /shop/?sale=1" value={p.url} onChange={(v) => setP({ ...p, url: v })} />
            <Text label="Message" value={p.body} placeholder="Your favourites at our lowest prices, ends Monday." onChange={(v) => setP({ ...p, body: v.slice(0, 240) })} className="md:col-span-2" />
          </div>
          <button disabled={busy || !p.title || !p.body || !hasKey} onClick={async () => { const r = await post({ push: p }); setMsg(r.error ? `Not sent: ${r.error}` : `Sent to ${r.sent} phone${r.sent === 1 ? "" : "s"}${r.failed ? `, ${r.failed} failed` : ""}.`); }} className="mt-3 rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Send now"}</button>
          {msg && <p className="mt-2 text-sm">{msg}</p>}
          {!hasKey && <p className="mt-2 text-xs text-sale">Add the Firebase key below first.</p>}
        </Card>
        <Card title="Firebase key" sub={<>Push notifications go through Google Firebase (free). In the Firebase console: Project settings → Service accounts → Generate new private key, then paste the whole file here. For iPhones, also upload your Apple push key (APNs) in Firebase → Cloud Messaging.</>}>
          <textarea value={key} onChange={(e) => setKey(e.target.value)} rows={4} placeholder='{"type":"service_account","project_id":"…","private_key":"…","client_email":"…"}' className="w-full rounded-lg border border-line px-3 py-2 font-mono text-xs outline-none focus:border-ink" />
          <button disabled={busy} onClick={async () => { const r = await post({ serviceAccount: key }); setMsg(r.error ?? "Key saved."); if (!r.error && key) setKey(mask); }} className="mt-2 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold">Save key</button>
        </Card>
        <Card title="Recent pushes">
          {!log.length ? <p className="text-sm text-muted">None yet.</p> : (
            <ul className="divide-y divide-line text-sm">{log.map((l, i) => <li key={i} className="flex justify-between gap-3 py-2"><span>{l.title}</span><span className="text-muted">{new Date(l.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {l.sent} sent{l.failed ? ` · ${l.failed} failed` : ""}</span></li>)}</ul>
          )}
        </Card>
      </div>
    </div>
  );
}
