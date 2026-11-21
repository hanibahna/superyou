"use client";

import { useEffect, useState } from "react";
import {
  automationInfo, emptyRules, templatePresets,
  type AutomationKey, type Campaign, type Contact, type LogEntry, type Segment, type WaConfig,
} from "@/lib/wa";
import { newId } from "@/lib/site";
import { Card, Chips, Header, ListInput, MediaField, Num, Select, Text, Toggle, useSaver } from "./fields";

type Env = { provider: string; meta: boolean; metaWaba: boolean; d360: boolean; wati: boolean; verifyToken: boolean; appSecret: boolean; webhookKey: string; cron: boolean };
type Tpl = { name: string; language: string; status: string; category: string; body: string; params: number; header?: string };
type Props = { initialConfig: WaConfig; env: Env; initialSegments: Segment[]; initialCampaigns: Campaign[]; log: LogEntry[]; brands: string[]; categories: { value: string; label: string }[]; services: string[] };

const tabs = ["Setup", "Automatic messages", "Templates", "Contacts", "Lists", "Campaigns", "Message log"] as const;
type Tab = (typeof tabs)[number];

function useTemplates() {
  const [tpl, setTpl] = useState<{ templates: Tpl[]; error?: string } | null>(null);
  const load = () => fetch("/api/admin/whatsapp/templates/").then((r) => r.json()).then(setTpl).catch(() => setTpl({ templates: [], error: "Could not load templates" }));
  useEffect(() => void load(), []);
  return { tpl, reload: load };
}

export function WhatsAppAdmin(p: Props) {
  const [tab, setTab] = useState<Tab>("Setup");
  const templates = useTemplates();
  const connected = p.env.provider !== "none";
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">WhatsApp</h1>
          <p className="text-sm text-muted">Automatic order & booking messages, contact lists and campaigns</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${connected && p.initialConfig.live ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
          {connected ? `${p.env.provider === "meta" ? "Meta Cloud API" : p.env.provider === "360dialog" ? "360dialog" : "WATI"} · ${p.initialConfig.live ? "LIVE" : "test mode"}` : "Not connected · test mode"}
        </span>
      </div>
      <div className="mb-5 flex flex-wrap gap-1 text-sm">
        {tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 ${tab === t ? "bg-ink text-white" : "bg-white hover:bg-brand-50"}`}>{t}</button>)}
      </div>
      {tab === "Setup" && <Setup {...p} templates={templates.tpl} />}
      {tab === "Automatic messages" && <Automations {...p} templates={templates.tpl} />}
      {tab === "Templates" && <Templates env={p.env} tpl={templates.tpl} reload={templates.reload} />}
      {tab === "Contacts" && <Contacts />}
      {tab === "Lists" && <Lists {...p} />}
      {tab === "Campaigns" && <Campaigns {...p} templates={templates.tpl} />}
      {tab === "Message log" && <Log log={p.log} />}
    </div>
  );
}

// ── Setup ───────────────────────────────────────────────

function Setup({ initialConfig, env, templates }: Props & { templates: { templates: Tpl[] } | null }) {
  const [c, setC] = useState(initialConfig);
  const saver = useSaver("/api/admin/whatsapp/config/");
  const [origin, setOrigin] = useState("");
  const [test, setTest] = useState({ template: "hello_world", language: "en_US", params: "" });
  const [res, setRes] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const hook = `${origin}/api/webhooks/whatsapp/${env.webhookKey ? `?key=${env.webhookKey}` : ""}`;
  const ok = (b: boolean) => (b ? <span className="text-green-700">✓</span> : <span className="text-sale">✗</span>);

  async function sendTest() {
    setRes("Sending…");
    const r = await fetch("/api/admin/whatsapp/test/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: c.testPhone, template: test.template, language: test.language, params: test.params ? test.params.split("|").map((x) => x.trim()) : [] }) }).then((x) => x.json());
    setRes(r.status === "test" ? "Logged in test mode (not sent). Turn on Live sending to really send." : r.status === "sent" ? `Sent ✓ (id ${r.id})` : `Failed: ${r.error}`);
  }

  return (
    <div className="space-y-5">
      <Header title="Connection" sub="Choose a provider in Vercel environment variables, then switch on live sending here" saver={saver} onSave={() => saver.save(c)} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Status">
          <ul className="space-y-1.5 text-sm">
            <li>{ok(env.provider !== "none")} Provider connected: <b>{env.provider === "none" ? "none yet" : env.provider}</b></li>
            <li>{ok(env.verifyToken || env.provider !== "meta")} Webhook verify token {env.provider === "meta" ? "(WHATSAPP_VERIFY_TOKEN)" : "(Meta only)"}</li>
            <li>{ok(env.provider !== "meta" || env.metaWaba)} Templates access {env.provider === "meta" && "(WHATSAPP_WABA_ID)"}</li>
            <li>{ok(env.cron)} Daily reminders secured (CRON_SECRET)</li>
          </ul>
          <div className="mt-4 grid gap-3">
            <Toggle label="Live sending" hint="Off = test mode: every message is written to the Message log but nothing is sent. Turn on once templates are approved." checked={c.live} onChange={(live) => (saver.touch(), setC({ ...c, live }))} />
            <Text label="Your WhatsApp number for test messages" value={c.testPhone} onChange={(testPhone) => (saver.touch(), setC({ ...c, testPhone }))} />
          </div>
        </Card>
        <Card title="Send a test message" sub="Uses an approved template. “hello_world” (en_US) exists on every new Meta account.">
          <div className="grid gap-3">
            <Select label="Template" value={test.template} onChange={(template) => setTest({ ...test, template, language: templates?.templates.find((t) => t.name === template)?.language ?? test.language })} options={[["hello_world", "hello_world"], ...(templates?.templates ?? []).filter((t) => t.name !== "hello_world").map((t) => [t.name, `${t.name} (${t.status.toLowerCase()})`] as [string, string])]} />
            <Text label="Language code" value={test.language} onChange={(language) => setTest({ ...test, language })} />
            <Text label="Variables, separated by |" value={test.params} onChange={(params) => setTest({ ...test, params })} placeholder="Rana | SUP-123 | $45" />
            <button onClick={sendTest} className="w-fit rounded-lg bg-[#25D366] px-4 py-2 text-sm font-bold text-white">Send test to {c.testPhone}</button>
            {res && <p className="text-sm">{res}</p>}
          </div>
        </Card>
      </div>
      <Card title="How to connect (pick one)">
        <div className="grid gap-5 text-sm lg:grid-cols-3">
          <div>
            <p className="font-semibold">360dialog (recommended)</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li>Sign up at 360dialog.com, connect your Meta business and +961 70 777 608 (keep using the WhatsApp Business app via “Coexistence”).</li>
              <li>Create an API key in the 360dialog hub.</li>
              <li>In Vercel → Settings → Environment Variables add <code>WHATSAPP_PROVIDER=360dialog</code> and <code>D360_API_KEY</code>, then redeploy.</li>
              <li>Come back here and click: <ConnectHook disabled={env.provider !== "360dialog"} /></li>
            </ol>
          </div>
          <div>
            <p className="font-semibold">Meta Cloud API (direct)</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li>developers.facebook.com → create an app (Business) → add WhatsApp.</li>
              <li>Add your number; create a permanent System User token with whatsapp_business_messaging and whatsapp_business_management.</li>
              <li>In Vercel add <code>WHATSAPP_PROVIDER=meta</code>, <code>WHATSAPP_TOKEN</code>, <code>WHATSAPP_PHONE_NUMBER_ID</code>, <code>WHATSAPP_WABA_ID</code>, <code>WHATSAPP_VERIFY_TOKEN</code> (any secret word), <code>WHATSAPP_APP_SECRET</code>.</li>
              <li>In the app's WhatsApp → Configuration set the callback URL below and your verify token; subscribe to <i>messages</i>.</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold">WATI</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li>In WATI → API Docs copy the API endpoint and access token.</li>
              <li>In Vercel add <code>WHATSAPP_PROVIDER=wati</code>, <code>WATI_API_URL</code>, <code>WATI_API_TOKEN</code>.</li>
              <li>In WATI → Webhooks add the URL below (events: message received, sent/delivered/read).</li>
              <li>Create templates inside WATI (copy the texts from the Templates tab).</li>
            </ol>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-[#fafafa] p-3 text-sm">
          <p className="font-medium">Webhook URL (delivery receipts, replies and STOP opt-outs)</p>
          <code className="mt-1 block break-all text-xs">{hook}</code>
          <p className="mt-2 text-xs text-muted">Optional extra security for 360dialog/WATI: add <code>WHATSAPP_WEBHOOK_KEY</code> (any secret word) in Vercel. Reminders run daily at 10:00 via Vercel Cron; add <code>CRON_SECRET</code> to secure them.</p>
        </div>
      </Card>
    </div>
  );
}

function ConnectHook({ disabled }: { disabled: boolean }) {
  const [msg, setMsg] = useState("");
  return (
    <span>
      <button disabled={disabled} onClick={async () => { setMsg("…"); const r = await fetch("/api/admin/whatsapp/webhook360/", { method: "POST" }).then((x) => x.json()); setMsg(r.ok ? "Connected ✓" : r.error); }} className="rounded border border-line bg-white px-2 py-0.5 text-xs font-semibold disabled:opacity-40">Connect webhook</button>
      {msg && <span className="ml-1 text-xs">{msg}</span>}
    </span>
  );
}

// ── Automations ─────────────────────────────────────────

function TemplateSelect({ label, value, onChange, templates }: { label: string; value: string; onChange: (v: string, t?: Tpl) => void; templates: { templates: Tpl[] } | null }) {
  const list = templates?.templates ?? [];
  if (!list.length) return <Text label={label} hint="Template name exactly as approved in WhatsApp" value={value} onChange={(v) => onChange(v.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} />;
  const opts: [string, string][] = list.map((t) => [t.name, `${t.name} · ${t.status.toLowerCase()} · ${t.params} variable(s)`]);
  if (value && !list.some((t) => t.name === value)) opts.unshift([value, `${value} (not found in your account)`]);
  return <Select label={label} value={value} onChange={(v) => onChange(v, list.find((t) => t.name === v))} options={[["", "— choose —"], ...opts]} />;
}

function Automations({ initialConfig, templates }: Props & { templates: { templates: Tpl[] } | null }) {
  const [c, setC] = useState(initialConfig);
  const saver = useSaver("/api/admin/whatsapp/config/");
  const up = (k: AutomationKey, patch: Partial<WaConfig["automations"][AutomationKey]>) => (saver.touch(), setC({ ...c, automations: { ...c.automations, [k]: { ...c.automations[k], ...patch } } }));
  return (
    <div>
      <Header title="Automatic messages" sub="Sent when something happens in the shop. Customers can untick order updates at checkout." saver={saver} onSave={() => saver.save(c)} />
      <div className="grid gap-4 lg:grid-cols-2">
        {(Object.keys(automationInfo) as AutomationKey[]).map((k) => {
          const a = c.automations[k];
          const info = automationInfo[k];
          const tpl = templates?.templates.find((t) => t.name === a.template);
          return (
            <Card key={k} title={info.label} sub={`${info.when} · ${info.category === "UTILITY" ? "utility message" : "marketing message"}`} actions={<Toggle label="" checked={a.enabled} onChange={(enabled) => up(k, { enabled })} />}>
              <div className={`grid gap-3 ${a.enabled ? "" : "opacity-50"}`}>
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <TemplateSelect label="Template" value={a.template} templates={templates} onChange={(template, t) => up(k, { template, ...(t ? { language: t.language } : {}) })} />
                  <Text label="Language" value={a.language} onChange={(language) => up(k, { language })} />
                </div>
                {tpl?.body && <p className="rounded bg-[#f3f7f3] p-2 text-xs text-muted">{tpl.body}</p>}
                <ListInput label={`Variables {{1}}, {{2}}… in order (one per line)`} rows={Math.max(2, a.params.length)} value={a.params} onChange={(params) => up(k, { params })} hint={<>Available: {info.tokens.map((t) => <code key={t} className="mr-1">{`{{${t}}}`}</code>)}</>} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Templates ───────────────────────────────────────────

function Templates({ env, tpl, reload }: { env: Env; tpl: { templates: Tpl[]; error?: string } | null; reload: () => void }) {
  const [msg, setMsg] = useState<Record<string, string>>({});
  const have = new Set((tpl?.templates ?? []).map((t) => t.name));
  async function create(t: (typeof templatePresets)[number]) {
    setMsg({ ...msg, [t.name]: "Submitting…" });
    const r = await fetch("/api/admin/whatsapp/templates/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...t, language: "en" }) }).then((x) => x.json());
    setMsg({ ...msg, [t.name]: r.ok ? "Submitted ✓ — Meta usually approves within minutes to a day" : r.error });
    if (r.ok) reload();
  }
  return (
    <div className="space-y-5">
      <Card title="Your templates" sub="WhatsApp only lets businesses start a conversation with pre-approved templates." actions={<button onClick={reload} className="rounded-lg border border-line px-3 py-1.5 text-sm">Refresh</button>}>
        {tpl?.error && <p className="text-sm text-amber-700">{tpl.error}</p>}
        {!tpl ? <p className="text-sm text-muted">Loading…</p> : tpl.templates.length === 0 ? <p className="text-sm text-muted">No templates yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted"><tr><th className="py-1">Name</th><th>Status</th><th>Category</th><th>Lang</th><th>Text</th></tr></thead>
            <tbody className="divide-y divide-line">
              {tpl.templates.map((t) => (
                <tr key={t.name + t.language}><td className="py-2 font-mono text-xs">{t.name}</td><td><span className={`rounded-full px-2 py-0.5 text-xs ${t.status === "APPROVED" ? "bg-green-100 text-green-800" : t.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{t.status.toLowerCase()}</span></td><td className="text-xs">{t.category.toLowerCase()}</td><td className="text-xs">{t.language}</td><td className="max-w-md truncate text-xs text-muted" title={t.body}>{t.body}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title="Ready-made templates for SuperYou" sub={env.provider === "wati" ? "With WATI, create these in your WATI dashboard — copy the text below." : "Submit them to WhatsApp for approval in one click."}>
        <div className="grid gap-3 lg:grid-cols-2">
          {templatePresets.map((t) => (
            <div key={t.name} className="rounded-lg border border-line p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold">{t.name}</span>
                <span className="text-xs text-muted">{t.category.toLowerCase()}{t.header ? " · image" : ""}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-muted">{t.body}</p>
              <div className="mt-2 flex items-center gap-2">
                {have.has(t.name) ? <span className="text-xs text-green-700">✓ In your account</span> : env.provider === "wati" || env.provider === "none" ? (
                  <button onClick={() => navigator.clipboard.writeText(t.body)} className="rounded border border-line px-2 py-1 text-xs">Copy text</button>
                ) : (
                  <button onClick={() => create(t)} className="rounded bg-ink px-2 py-1 text-xs text-white">Submit for approval</button>
                )}
                {msg[t.name] && <span className="text-xs">{msg[t.name]}</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Contacts ────────────────────────────────────────────

function Contacts() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; items: Contact[]; counts: { all: number; offers: number; out: number } } | null>(null);
  const [importing, setImporting] = useState("");
  const [consent, setConsent] = useState(false);
  const load = () => fetch(`/api/admin/whatsapp/contacts/?q=${encodeURIComponent(q)}&filter=${filter}&page=${page}`).then((r) => r.json()).then(setData);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q, filter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(phone: string, body: Record<string, unknown>) {
    await fetch("/api/admin/whatsapp/contacts/", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, ...body }) });
    load();
  }
  async function importCsv(file: File) {
    const text = await file.text();
    const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
    const head = lines[0].toLowerCase().split(/[,;\t]/).map((h) => h.replace(/"/g, "").trim());
    const pi = head.findIndex((h) => /phone|mobile|whatsapp|number/.test(h));
    const ni = head.findIndex((h) => /name/.test(h));
    const ei = head.findIndex((h) => /mail/.test(h));
    const rows = lines.slice(pi >= 0 ? 1 : 0).map((l) => l.split(/[,;\t]/).map((x) => x.replace(/^"|"$/g, "").trim())).map((c) => ({ phone: c[pi >= 0 ? pi : 0], name: ni >= 0 ? c[ni] : undefined, email: ei >= 0 ? c[ei] : undefined })).filter((r) => r.phone);
    setImporting(`Importing ${rows.length}…`);
    const r = await fetch("/api/admin/whatsapp/contacts/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, offers: consent }) }).then((x) => x.json());
    setImporting(`Imported ${r.ok}${r.bad ? `, ${r.bad} invalid numbers skipped` : ""}`);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[["All contacts", data?.counts.all], ["Opted in to offers", data?.counts.offers], ["Unsubscribed", data?.counts.out]].map(([l, n]) => (
          <div key={l as string} className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs uppercase text-muted">{l}</p><p className="text-2xl font-bold">{(n as number | undefined)?.toLocaleString("en-US") ?? "–"}</p></div>
        ))}
      </div>
      <Card title="Contacts" sub="Added automatically from checkout, bookings and newsletter sign-ups. Only people who opted in receive campaigns." actions={
        <div className="flex gap-2">
          <a href="/api/admin/whatsapp/contacts/?format=csv" className="rounded-lg border border-line px-3 py-1.5 text-sm">Export CSV</a>
        </div>
      }>
        <div className="mb-3 flex flex-wrap gap-2">
          <input value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} placeholder="Search name, phone, email, tag…" className="flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
          {[["all", "All"], ["offers", "Opted in"], ["out", "Unsubscribed"]].map(([k, l]) => <button key={k} onClick={() => (setFilter(k), setPage(1))} className={`rounded-full px-3 text-sm ${filter === k ? "bg-ink text-white" : "border border-line"}`}>{l}</button>)}
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted"><tr><th className="py-1">Contact</th><th>Orders</th><th>Joined via</th><th>Order updates</th><th>Offers</th><th /></tr></thead>
          <tbody className="divide-y divide-line">
            {data?.items.map((c) => (
              <tr key={c.phone}>
                <td className="py-2"><b>{c.name || "—"}</b><br /><a href={`https://wa.me/${c.phone}`} target="_blank" rel="noreferrer" className="text-xs text-brand-600">+{c.phone}</a> {c.tags.map((t) => <span key={t} className="ml-1 rounded bg-brand-50 px-1 text-[10px]">{t}</span>)}</td>
                <td className="text-xs">{c.orders} · ${c.spent.toFixed(0)}</td>
                <td className="text-xs">{c.sources.join(", ")}</td>
                <td><input type="checkbox" checked={c.updates} onChange={(e) => patch(c.phone, { updates: e.target.checked })} /></td>
                <td><input type="checkbox" checked={c.offers} onChange={(e) => patch(c.phone, { offers: e.target.checked })} /> {c.optOutAt && !c.offers && <span className="text-[10px] text-sale">STOP</span>}</td>
                <td className="text-right"><button onClick={() => { const t = window.prompt("Tags (comma separated)", c.tags.join(", ")); if (t !== null) patch(c.phone, { tags: t.split(",").map((x) => x.trim()).filter(Boolean) }); }} className="text-xs text-brand-600">Tags</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.total > 50 && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded border border-line px-2 disabled:opacity-30">‹</button>
            Page {page} of {Math.ceil(data.total / 50)}
            <button disabled={page * 50 >= data.total} onClick={() => setPage(page + 1)} className="rounded border border-line px-2 disabled:opacity-30">›</button>
          </div>
        )}
      </Card>
      <Card title="Import contacts" sub="CSV or Excel export with a phone column (name and email optional). Lebanese numbers like 03 123 456 are converted to +961 automatically.">
        <label className="mb-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" /> These people agreed to receive offers from us on WhatsApp (required by WhatsApp's rules — otherwise they're imported for order updates only)</label>
        <input type="file" accept=".csv,.txt" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} className="text-sm" />
        {importing && <p className="mt-2 text-sm">{importing}</p>}
      </Card>
    </div>
  );
}

// ── Lists ───────────────────────────────────────────────

function Lists({ initialSegments, brands, categories, services }: Props) {
  const [s, setS] = useState(initialSegments);
  const [open, setOpen] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const saver = useSaver("/api/admin/whatsapp/segments/");
  const up = (id: string, patch: Partial<Segment>) => (saver.touch(), setS(s.map((x) => (x.id === id ? { ...x, ...patch } : x))));
  const count = async (seg: Segment) => {
    const r = await fetch("/api/admin/whatsapp/segments/", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(seg.rules) }).then((x) => x.json());
    setCounts((c) => ({ ...c, [seg.id]: r.count }));
  };
  useEffect(() => { s.forEach(count); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const presets: { name: string; rules: Partial<Segment["rules"]> }[] = [
    { name: "VIP (spent $200+)", rules: { minSpent: 200 } },
    { name: "Bought in the last 30 days", rules: { boughtWithinDays: 30 } },
    { name: "Win back: no order for 90 days", rules: { minOrders: 1, notBoughtForDays: 90 } },
    { name: "Skin care buyers", rules: { categories: ["skincare"] } },
    { name: "Fragrance buyers", rules: { categories: ["fragrance"] } },
    { name: "Booked a service", rules: { sources: ["booking"] } },
    { name: "Newsletter sign-ups", rules: { sources: ["newsletter"] } },
  ];
  return (
    <div>
      <Header title="Lists" sub="Groups of opted-in contacts to send campaigns to. Counts update as customers buy." saver={saver} onSave={() => saver.save(s)} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <span className="self-center text-muted">Add:</span>
        {presets.map((p) => (
          <button key={p.name} onClick={() => { const seg: Segment = { id: newId(), name: p.name, rules: { ...emptyRules(), ...p.rules } }; saver.touch(); setS([...s, seg]); setOpen(seg.id); count(seg); }} className="rounded-full border border-line bg-white px-3 py-1 hover:border-ink">{p.name}</button>
        ))}
        <button onClick={() => { const seg: Segment = { id: newId(), name: "New list", rules: emptyRules() }; saver.touch(); setS([...s, seg]); setOpen(seg.id); count(seg); }} className="rounded-full bg-ink px-3 py-1 text-white">+ Custom list</button>
      </div>
      <div className="space-y-2">
        {s.length === 0 && <p className="text-sm text-muted">No lists yet. Campaigns can also go to everyone who opted in.</p>}
        {s.map((seg) => (
          <div key={seg.id} className="rounded-xl bg-white shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3 text-sm">
              <button onClick={() => setOpen(open === seg.id ? null : seg.id)} className="flex-1 text-left font-semibold">{seg.name}</button>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold">{counts[seg.id] ?? "…"} people</span>
              <button onClick={() => count(seg)} className="text-xs text-brand-600">Recount</button>
              <button onClick={() => (saver.touch(), setS(s.filter((x) => x.id !== seg.id)))} className="text-xs text-sale">Delete</button>
            </div>
            {open === seg.id && (
              <div className="grid gap-4 border-t border-line p-4 md:grid-cols-2">
                <Text label="Name" value={seg.name} onChange={(name) => up(seg.id, { name })} />
                <div className="grid grid-cols-2 gap-2">
                  <Num label="Spent at least ($)" value={seg.rules.minSpent} onChange={(minSpent) => up(seg.id, { rules: { ...seg.rules, minSpent } })} />
                  <Num label="Orders at least" value={seg.rules.minOrders} onChange={(minOrders) => up(seg.id, { rules: { ...seg.rules, minOrders } })} />
                  <Num label="Bought within (days)" hint="0 = any time" value={seg.rules.boughtWithinDays} onChange={(boughtWithinDays) => up(seg.id, { rules: { ...seg.rules, boughtWithinDays } })} />
                  <Num label="No order for (days)" hint="0 = ignore" value={seg.rules.notBoughtForDays} onChange={(notBoughtForDays) => up(seg.id, { rules: { ...seg.rules, notBoughtForDays } })} />
                </div>
                <Chips label="Bought in categories" options={categories} value={seg.rules.categories} onChange={(categories) => up(seg.id, { rules: { ...seg.rules, categories } })} />
                <Chips label="Joined via" options={[["checkout", "Checkout"], ["booking", "Booking"], ["newsletter", "Newsletter"], ["import", "Import"], ["whatsapp", "Messaged us"]].map(([value, label]) => ({ value, label }))} value={seg.rules.sources} onChange={(sources) => up(seg.id, { rules: { ...seg.rules, sources } })} />
                <ListInput label="Bought any of these brands" hint={`e.g. ${brands.slice(0, 3).join(", ")}`} value={seg.rules.brands} onChange={(b) => up(seg.id, { rules: { ...seg.rules, brands: b } })} />
                <Chips label="Booked these services / events" options={services.map((x) => ({ value: x, label: x }))} value={seg.rules.services} onChange={(sv) => up(seg.id, { rules: { ...seg.rules, services: sv } })} />
                <ListInput label="Has any of these tags" value={seg.rules.tags} onChange={(tags) => up(seg.id, { rules: { ...seg.rules, tags } })} />
                <button onClick={() => count(seg)} className="w-fit self-end rounded-lg border border-line px-3 py-1.5 text-sm">Count people</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Campaigns ───────────────────────────────────────────

function Campaigns({ initialCampaigns, initialSegments, templates }: Props & { templates: { templates: Tpl[] } | null }) {
  const [c, setC] = useState(initialCampaigns);
  const [open, setOpen] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const saver = useSaver("/api/admin/whatsapp/campaigns/");
  const up = (id: string, patch: Partial<Campaign>) => (saver.touch(), setC(c.map((x) => (x.id === id ? { ...x, ...patch } : x))));
  const segName = (id: string) => initialSegments.find((s) => s.id === id)?.name ?? "Everyone who opted in";

  async function send(camp: Campaign) {
    if (!window.confirm(`Send “${camp.name}” to ${segName(camp.segmentId)} now?`)) return;
    await saver.save(c);
    let done = false;
    while (!done) {
      const r = await fetch(`/api/admin/whatsapp/campaigns/${camp.id}/send/`, { method: "POST" }).then((x) => x.json());
      if (r.error) { setProgress((p) => ({ ...p, [camp.id]: `Error: ${r.error}` })); return; }
      done = r.done;
      setProgress((p) => ({ ...p, [camp.id]: `${r.sent} / ${r.total} sent${r.errors?.length ? ` · last error: ${r.errors[0]}` : ""}` }));
      setC((list) => list.map((x) => (x.id === camp.id ? { ...x, status: done ? "sent" : "sending", stats: r.stats, cursor: r.sent } : x)));
    }
  }

  return (
    <div>
      <Header title="Campaigns" sub="Send an approved marketing template to a list. Personalise with {{first_name}}." saver={saver} onSave={() => saver.save(c)} extra={
        <button onClick={() => { const n: Campaign = { id: newId(), name: "Black Friday 2026", segmentId: "", template: "black_friday_2026", language: "en", params: ["{{first_name}}", "https://shopsuperyou.com/collections/value-deals/"], headerImage: "", status: "draft", createdAt: new Date().toISOString(), stats: { targeted: 0, sent: 0, failed: 0, delivered: 0, read: 0, replied: 0 }, cursor: 0 }; saver.touch(); setC([n, ...c]); setOpen(n.id); }} className="rounded-lg bg-ink px-3 py-2 text-sm text-white">+ New campaign</button>
      } />
      <div className="space-y-2">
        {c.length === 0 && <p className="text-sm text-muted">No campaigns yet.</p>}
        {c.map((camp) => {
          const st = camp.stats;
          const pct = (n: number) => (st.sent ? `${Math.round((n / st.sent) * 100)}%` : "–");
          return (
            <div key={camp.id} className="rounded-xl bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${camp.status === "sent" ? "bg-green-100 text-green-800" : camp.status === "sending" ? "bg-amber-100 text-amber-800" : "bg-line"}`}>{camp.status}</span>
                <button onClick={() => setOpen(open === camp.id ? null : camp.id)} className="flex-1 text-left"><b>{camp.name}</b> <span className="text-muted">→ {segName(camp.segmentId)} · {camp.template}</span></button>
                {camp.status !== "draft" && <span className="text-xs text-muted">sent {st.sent} · delivered {pct(st.delivered)} · read {pct(st.read)} · replies {st.replied}{st.failed ? ` · failed ${st.failed}` : ""}</span>}
                {camp.status !== "sent" && <button onClick={() => send(camp)} className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white">{camp.status === "sending" ? "Resume" : "Send now"}</button>}
                {camp.status === "draft" && <button onClick={() => (saver.touch(), setC(c.filter((x) => x.id !== camp.id)))} className="text-xs text-sale">Delete</button>}
              </div>
              {progress[camp.id] && <p className="px-4 pb-2 text-xs">{progress[camp.id]}</p>}
              {open === camp.id && camp.status === "draft" && (
                <div className="grid gap-4 border-t border-line p-4 md:grid-cols-2">
                  <Text label="Campaign name" value={camp.name} onChange={(name) => up(camp.id, { name })} />
                  <Select label="Send to" value={camp.segmentId} onChange={(segmentId) => up(camp.id, { segmentId })} options={[["", "Everyone who opted in"], ...initialSegments.map((s) => [s.id, s.name] as [string, string])]} />
                  <div className="grid grid-cols-[1fr_90px] gap-2">
                    <TemplateSelect label="Template (marketing)" value={camp.template} templates={templates} onChange={(template, t) => up(camp.id, { template, ...(t ? { language: t.language, params: Array.from({ length: t.params }, (_, i) => camp.params[i] ?? (i === 0 ? "{{first_name}}" : "")) } : {}) })} />
                    <Text label="Language" value={camp.language} onChange={(language) => up(camp.id, { language })} />
                  </div>
                  <MediaField label="Header image (only for templates with an image header)" value={camp.headerImage} onChange={(headerImage) => up(camp.id, { headerImage })} />
                  <ListInput className="md:col-span-2" label="Variables {{1}}, {{2}}… (one per line). {{first_name}} is replaced for each person." rows={3} value={camp.params} onChange={(params) => up(camp.id, { params })} />
                  {templates?.templates.find((t) => t.name === camp.template)?.body && <p className="rounded bg-[#f3f7f3] p-3 text-sm text-muted md:col-span-2">{templates.templates.find((t) => t.name === camp.template)!.body}</p>}
                  <p className="text-xs text-muted md:col-span-2">Tip: send a test from the Setup tab first. Contacts who replied STOP are never included.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Log ─────────────────────────────────────────────────

function Log({ log }: { log: LogEntry[] }) {
  const color: Record<string, string> = { test: "bg-line", sent: "bg-blue-100 text-blue-800", delivered: "bg-green-100 text-green-800", read: "bg-green-200 text-green-900", failed: "bg-red-100 text-red-700", received: "bg-amber-100 text-amber-800", queued: "bg-line" };
  return (
    <Card title="Latest messages" sub="Sent messages with delivery status, and replies from customers (reply within 24 hours from the WhatsApp Business app — free).">
      {log.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
      <table className="w-full text-sm">
        <tbody className="divide-y divide-line">
          {log.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap py-2 text-xs text-muted">{new Date(e.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
              <td className="px-2"><span className={`rounded-full px-2 py-0.5 text-xs ${color[e.status]}`}>{e.status}</span></td>
              <td className="text-xs">{e.name || "+" + e.to}</td>
              <td className="text-xs text-muted">{e.kind}</td>
              <td className="max-w-md truncate text-xs" title={e.error || e.text}>{e.error ? <span className="text-sale">{e.error}</span> : e.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
