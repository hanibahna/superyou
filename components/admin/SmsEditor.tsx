"use client";

import { useState } from "react";
import { SMS_EVENTS, SMS_MASK, SMS_PROVIDERS, type SmsConfig, type SmsEvent, type SmsProvider } from "@/lib/sms-config";
import { Area, Card, Header, Select, Text, Toggle, useSaver } from "./fields";

type Log = { at: string; to: string; event: string; ok: boolean; error?: string; provider: string };

export function SmsEditor({ initial, log }: { initial: SmsConfig; log: Log[] }) {
  const [s, setS] = useState(initial);
  const saver = useSaver("/api/admin/sms/");
  const set = (p: Partial<SmsConfig>) => (saver.touch(), setS({ ...s, ...p }));
  const prov = SMS_PROVIDERS.find((p) => p.id === s.provider);
  const creds = s.creds[s.provider] ?? {};
  const setCred = (k: string, v: string) => set({ creds: { ...s.creds, [s.provider]: { ...creds, [k]: v } } });
  const ready = !!prov && prov.fields.filter((f) => !f.label.includes("optional") && f.k !== "region").every((f) => creds[f.k]);
  const [phone, setPhone] = useState("");
  const [test, setTest] = useState("");
  const [busy, setBusy] = useState(false);
  const sendTest = async () => {
    setBusy(true);
    setTest("");
    const r = await fetch("/api/admin/sms/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test: { phone, text: `SuperYou test message. If you got this, SMS works.` } }) }).then((x) => x.json()).catch(() => ({ ok: false, error: "Network error" }));
    setBusy(false);
    setTest(r.ok ? "Sent ✓ Check the phone." : `Not sent: ${r.error}`);
  };

  return (
    <div>
      <Header title="SMS" sub="Text messages through an SMS provider, for customers who aren't on WhatsApp or when a WhatsApp message fails. Keys stay on the server." saver={saver} onSave={() => saver.save(s)} />
      <div className="space-y-5">
        <Card title="Provider" sub="Pick one. Each has a ready-made connection: paste the keys from your account with them. You sign up and pay the provider directly.">
          <div className="grid gap-3 md:grid-cols-2">
            {SMS_PROVIDERS.map((p) => (
              <button key={p.id} type="button" onClick={() => set({ provider: p.id })} className={`rounded-xl border p-4 text-left ${s.provider === p.id ? "border-ink ring-1 ring-ink" : "border-line"}`}>
                <span className="flex items-center justify-between gap-2"><span className="font-semibold">{p.name}</span>{Object.values(s.creds[p.id] ?? {}).some(Boolean) && <span className="whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Keys saved</span>}</span>
                <span className="mt-1 block text-xs text-muted">{p.about}</span>
              </button>
            ))}
          </div>
        </Card>

        {prov && (
          <Card title={`${prov.name} keys`} sub={prov.signup ? <a href={prov.signup} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">Open {prov.name} console ↗</a> : undefined}>
            <div className="grid gap-3 md:grid-cols-2">
              {prov.fields.map((f) =>
                f.k === "body" ? (
                  <Area key={f.k} label={f.label} value={creds[f.k] ?? ""} placeholder={f.ph} onChange={(v) => setCred(f.k, v)} rows={2} className="md:col-span-2" />
                ) : (
                  <Text key={f.k} label={f.label} placeholder={f.ph} type={f.secret ? "password" : "text"} value={creds[f.k] ?? ""} hint={f.secret && creds[f.k] === SMS_MASK ? "Saved. Type a new one to replace it." : undefined} onChange={(v) => setCred(f.k, v)} className={f.k === "url" ? "md:col-span-2" : ""} />
                ),
              )}
            </div>
          </Card>
        )}

        <Card title="Sending">
          <div className="grid gap-4 md:grid-cols-2">
            <Toggle label="Send SMS" hint={ready ? "Order texts go out as set below." : "Choose a provider and save its keys first."} checked={s.enabled} onChange={(v) => set({ enabled: v })} />
            <Text label="Sender name" hint="Shown instead of a number: up to 11 letters or digits. Lebanon accepts named senders on Alfa and touch." value={s.senderId} onChange={(v) => set({ senderId: v.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 11) })} />
            <Select label="When" value={s.mode} onChange={(v) => set({ mode: v })} options={[["fallback", "Only when WhatsApp didn't reach the customer (cheaper)"], ["always", "Always, as well as WhatsApp"]]} className="md:col-span-2" />
          </div>
        </Card>

        <Card title="Messages" sub="Placeholders: {first_name} {order_id} {total} {link} {courier} {tracking} {tracking_link}. Keep under 160 characters for one SMS (70 in Arabic).">
          <div className="space-y-4">
            {(Object.keys(SMS_EVENTS) as SmsEvent[]).map((k) => (
              <div key={k} className="rounded-xl border border-line p-3">
                <Toggle label={SMS_EVENTS[k].label} checked={s.events[k].enabled} onChange={(v) => set({ events: { ...s.events, [k]: { ...s.events[k], enabled: v } } })} />
                {s.events[k].enabled && <Area label="" value={s.events[k].text} onChange={(v) => set({ events: { ...s.events, [k]: { ...s.events[k], text: v } } })} rows={2} hint={`${s.events[k].text.length} characters`} />}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Send a test" sub="Uses the saved settings: save first.">
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <Text label="Mobile number" placeholder="+961 3 123 456" value={phone} onChange={setPhone} className="md:w-72" />
            <button type="button" disabled={busy || !phone} onClick={sendTest} className="rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Send test SMS"}</button>
          </div>
          {test && <p className={`mt-2 text-sm ${test.startsWith("Sent") ? "text-green-700" : "text-sale"}`}>{test}</p>}
        </Card>

        <Card title="Recent SMS">
          {!log.length ? <p className="text-sm text-muted">None yet.</p> : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="p-2">When</th><th className="p-2">To</th><th className="p-2">Message</th><th className="p-2">Result</th></tr></thead>
                <tbody>{log.map((l, i) => <tr key={i} className="border-t border-line"><td className="p-2">{new Date(l.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td><td className="p-2">{l.to}</td><td className="p-2">{SMS_EVENTS[l.event as SmsEvent]?.label ?? l.event}</td><td className={`p-2 ${l.ok ? "text-green-700" : "text-sale"}`}>{l.ok ? "Sent" : l.error}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
