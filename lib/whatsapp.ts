import "server-only";

// WhatsApp messaging engine. Works with Meta's Cloud API directly, 360dialog or WATI —
// chosen by environment variables in Vercel. Without credentials (or with "Live sending" off
// in the admin) everything runs in test mode: messages are written to the log, not sent.

import { db } from "@/lib/db";
import { getSettings } from "@/lib/site-store";
import {
  automationInfo,
  defaultWaConfig, fill, inSegment, normPhone,
  type AutomationKey, type Campaign, type Contact, type LogEntry, type Segment, type WaConfig,
} from "@/lib/wa";

export type Provider = "meta" | "360dialog" | "wati" | "none";

export function provider(): Provider {
  const p = (process.env.WHATSAPP_PROVIDER || "").toLowerCase();
  if (p === "360dialog" && process.env.D360_API_KEY) return "360dialog";
  if (p === "wati" && process.env.WATI_API_URL && process.env.WATI_API_TOKEN) return "wati";
  if ((p === "meta" || !p) && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) return "meta";
  return "none";
}

const META = "https://graph.facebook.com/v21.0";
const D360 = "https://waba-v2.360dialog.io";

// ── Config ──────────────────────────────────────────────

export async function getWaConfig(): Promise<WaConfig> {
  const raw = await db.cmd<string | null>(["GET", "wa:config"]);
  const v = raw ? (JSON.parse(raw) as Partial<WaConfig>) : {};
  return { ...defaultWaConfig, ...v, automations: { ...defaultWaConfig.automations, ...(v.automations ?? {}) } };
}
export const saveWaConfig = (c: WaConfig) => db.cmd(["SET", "wa:config", JSON.stringify(c)]);

// ── Contacts ────────────────────────────────────────────

export async function getContact(phone: string): Promise<Contact | null> {
  const raw = await db.cmd<string | null>(["HGET", "wa:contacts", phone]);
  return raw ? (JSON.parse(raw) as Contact) : null;
}

export async function allContacts(): Promise<Contact[]> {
  const out: Contact[] = [];
  let cursor = "0";
  do {
    const [next, flat] = (await db.cmd<[string, string[]]>(["HSCAN", "wa:contacts", cursor, "COUNT", 2000])) ?? ["0", []];
    for (let i = 1; i < flat.length; i += 2) out.push(JSON.parse(flat[i]) as Contact);
    cursor = String(next);
  } while (cursor !== "0");
  return out;
}

const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));

/** Create or update a contact. Returns the contact and whether they just opted in to offers. */
export async function upsertContact(input: {
  phone: string; name?: string; email?: string; source: string; updates?: boolean; offers?: boolean;
  order?: { total: number; brands: string[]; categories: string[] }; service?: string; tags?: string[];
}): Promise<{ contact: Contact; newOptIn: boolean } | null> {
  const phone = normPhone(input.phone);
  if (!phone) return null;
  const now = new Date().toISOString();
  const c: Contact = (await getContact(phone)) ?? {
    phone, name: "", email: "", updates: true, offers: false, sources: [], tags: [], orders: 0, spent: 0, brands: [], categories: [], services: [], createdAt: now,
  };
  const wasOptedIn = c.offers;
  if (input.name) c.name = input.name.trim();
  if (input.email) c.email = input.email.trim();
  if (input.updates !== undefined) c.updates = input.updates;
  if (input.offers === true && !c.offers) Object.assign(c, { offers: true, optInAt: now, optOutAt: undefined });
  c.sources = uniq([...c.sources, input.source]);
  if (input.tags) c.tags = uniq([...c.tags, ...input.tags]);
  if (input.order) {
    c.orders += 1;
    c.spent = +(c.spent + input.order.total).toFixed(2);
    c.lastOrderAt = now;
    c.brands = uniq([...c.brands, ...input.order.brands]).slice(-200);
    c.categories = uniq([...c.categories, ...input.order.categories]);
  }
  if (input.service) c.services = uniq([...c.services, input.service]);
  await db.cmd(["HSET", "wa:contacts", phone, JSON.stringify(c)]);
  return { contact: c, newOptIn: !wasOptedIn && c.offers };
}

export async function saveContact(c: Contact) {
  await db.cmd(["HSET", "wa:contacts", c.phone, JSON.stringify(c)]);
}

export async function deleteContact(phone: string) {
  await db.cmd(["HDEL", "wa:contacts", phone]);
}

// ── Log ─────────────────────────────────────────────────

export async function log(e: LogEntry) {
  await db.pipeline([["HSET", "wa:log", e.id, JSON.stringify(e)], ["ZADD", "wa:logidx", Date.parse(e.at) || Date.now(), e.id]]);
}

export async function recentLog(limit = 300): Promise<LogEntry[]> {
  const ids = (await db.cmd<string[]>(["ZREVRANGE", "wa:logidx", 0, limit - 1])) ?? [];
  if (!ids.length) return [];
  const rows = await db.pipeline(ids.map((id) => ["HGET", "wa:log", id]));
  return rows.map((r) => (r ? (JSON.parse(String(r)) as LogEntry) : null)).filter((x): x is LogEntry => !!x);
}

async function updateLog(id: string, patch: Partial<LogEntry>) {
  const raw = await db.cmd<string | null>(["HGET", "wa:log", id]);
  if (!raw) return null;
  const e = { ...(JSON.parse(raw) as LogEntry), ...patch };
  await db.cmd(["HSET", "wa:log", id, JSON.stringify(e)]);
  return e;
}

// ── Sending ─────────────────────────────────────────────

export type SendInput = { to: string; name?: string; template: string; language: string; params: string[]; headerImage?: string; kind: string; buttons?: string[] /* quick-reply payloads, in button order */ };

/** Send one template message (or log it in test mode). Never throws. */
export async function sendTemplate(m: SendInput): Promise<LogEntry> {
  const to = normPhone(m.to);
  const cfg = await getWaConfig();
  const p = provider();
  const text = `[${m.template}] ${m.params.join(" | ")}`;
  const base = { to, name: m.name ?? "", template: m.template, text, kind: m.kind, at: new Date().toISOString() };
  if (!to) return { ...base, id: `x-${Date.now()}`, status: "failed", error: "Invalid phone number" };
  if (!m.template) return { ...base, id: `x-${Date.now()}`, status: "failed", error: "No template chosen" };

  if (!cfg.live || p === "none") {
    const e: LogEntry = { ...base, id: `test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, status: "test" };
    await log(e);
    return e;
  }

  try {
    let id = "";
    if (p === "wati") {
      const url = `${process.env.WATI_API_URL!.replace(/\/$/, "")}/api/v1/sendTemplateMessage?whatsappNumber=${to}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.WATI_API_TOKEN!.replace(/^Bearer\s+/i, "")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ template_name: m.template, broadcast_name: m.kind, parameters: m.params.map((value, i) => ({ name: String(i + 1), value })) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.result === false) throw new Error(d.info || d.message || `WATI error ${r.status}`);
      id = d.id || d.localMessageId || `wati-${Date.now().toString(36)}`;
    } else {
      const components: unknown[] = [];
      if (m.headerImage) components.push({ type: "header", parameters: [{ type: "image", image: { link: m.headerImage } }] });
      if (m.params.length) components.push({ type: "body", parameters: m.params.map((t) => ({ type: "text", text: t || "-" })) });
      m.buttons?.forEach((payload, i) => components.push({ type: "button", sub_type: "quick_reply", index: String(i), parameters: [{ type: "payload", payload }] }));
      const body = { messaging_product: "whatsapp", recipient_type: "individual", to, type: "template", template: { name: m.template, language: { code: m.language || "en" }, components } };
      const r = p === "360dialog"
        ? await fetch(`${D360}/messages`, { method: "POST", headers: { "D360-API-KEY": process.env.D360_API_KEY!, "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch(`${META}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, { method: "POST", headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.error_data?.details || d?.error?.message || d?.meta?.developer_message || `Error ${r.status}`);
      id = d?.messages?.[0]?.id ?? `wa-${Date.now().toString(36)}`;
    }
    const e: LogEntry = { ...base, id, status: "sent" };
    await log(e);
    return e;
  } catch (err) {
    const e: LogEntry = { ...base, id: `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, status: "failed", error: (err as Error).message.slice(0, 300) };
    await log(e);
    return e;
  }
}

/** Fire an automation (order / booking events). Respects the contact's choices. */
/** Sends an automation; true when the WhatsApp message went out (lets SMS step in when it didn't). */
export async function trigger(key: AutomationKey, phone: string, vars: Record<string, string>, extra: { headerImage?: string; buttons?: string[] } = {}): Promise<boolean> {
  try {
    const cfg = await getWaConfig();
    const a = cfg.automations[key];
    if (!a?.enabled || !a.template) return false;
    const c = await getContact(normPhone(phone));
    const marketing = automationInfo[key].category === "MARKETING";
    if (marketing ? !c?.offers : c && !c.updates) return false;
    const r = await sendTemplate({ to: phone, name: vars.first_name, template: a.template, language: a.language, params: a.params.map((s) => fill(s, vars)), kind: key, ...extra });
    return r.status !== "failed";
  } catch (e) {
    console.error("[whatsapp]", key, e);
    return false;
  }
}

// ── Lists & campaigns ───────────────────────────────────

export async function getSegments(): Promise<Segment[]> {
  const raw = await db.cmd<string | null>(["GET", "wa:segments"]);
  return raw ? (JSON.parse(raw) as Segment[]) : [];
}
export const saveSegments = (s: Segment[]) => db.cmd(["SET", "wa:segments", JSON.stringify(s)]);

export async function audience(segmentId: string): Promise<Contact[]> {
  const [contacts, segments] = await Promise.all([allContacts(), getSegments()]);
  const seg = segments.find((s) => s.id === segmentId);
  return contacts.filter((c) => c.offers && (!seg || inSegment(c, seg.rules))).sort((a, b) => a.phone.localeCompare(b.phone));
}

export async function getCampaigns(): Promise<Campaign[]> {
  const raw = await db.cmd<string | null>(["GET", "wa:campaigns"]);
  return raw ? (JSON.parse(raw) as Campaign[]) : [];
}
export const saveCampaigns = (c: Campaign[]) => db.cmd(["SET", "wa:campaigns", JSON.stringify(c)]);

/** Send the next batch of a campaign. Called repeatedly by the admin page until done. */
export async function sendCampaignBatch(id: string, size = 40) {
  const campaigns = await getCampaigns();
  const c = campaigns.find((x) => x.id === id);
  if (!c) throw new Error("Campaign not found");
  const people = await audience(c.segmentId);
  if (c.status === "draft") Object.assign(c, { status: "sending", cursor: 0, stats: { ...c.stats, targeted: people.length, sent: 0, failed: 0 } });
  const batch = people.slice(c.cursor, c.cursor + size);
  const store = (await getSettings()).store;
  const results = await Promise.all(
    batch.map((p) =>
      sendTemplate({
        to: p.phone, name: p.name, template: c.template, language: c.language, headerImage: c.headerImage || undefined, kind: `campaign:${c.id}`,
        params: c.params.map((s) => fill(s, { first_name: (p.name || "there").split(" ")[0], name: p.name || "there", store: store.name })),
      }),
    ),
  );
  c.cursor += batch.length;
  c.stats.sent += results.filter((r) => r.status === "sent" || r.status === "test").length;
  c.stats.failed += results.filter((r) => r.status === "failed").length;
  const done = c.cursor >= people.length;
  if (done) Object.assign(c, { status: "sent", sentAt: new Date().toISOString() });
  await saveCampaigns(campaigns.map((x) => (x.id === c.id ? c : x)));
  return { done, sent: c.cursor, total: people.length, stats: c.stats, errors: results.filter((r) => r.error).slice(0, 3).map((r) => r.error) };
}

// ── Webhooks (delivery receipts, replies, STOP) ─────────

const STOP = /^\s*(stop|unsubscribe|cancel|stop all|إلغاء|الغاء|توقف|arrêt|arreter)\s*$/i;
const START = /^\s*(start|subscribe|unstop)\s*$/i;

export async function handleInbound(from: string, text: string, name?: string) {
  const phone = normPhone(from);
  if (!phone) return;
  const now = new Date().toISOString();
  const c = (await getContact(phone)) ?? null;
  await log({ id: `in-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, to: phone, name: name ?? c?.name ?? "", template: "", text, kind: "reply", status: "received", at: now });
  if (!c) {
    await upsertContact({ phone, name, source: "whatsapp" });
  }
  const contact = (await getContact(phone))!;
  contact.lastInboundAt = now;
  if (STOP.test(text)) Object.assign(contact, { offers: false, optOutAt: now });
  if (START.test(text)) Object.assign(contact, { offers: true, optInAt: now, optOutAt: undefined });
  await saveContact(contact);
  // Count replies to campaigns sent in the last 3 days.
  const recent = (await recentLog(200)).find((e) => e.to === phone && e.kind.startsWith("campaign:") && Date.now() - Date.parse(e.at) < 3 * 86400_000);
  if (recent) {
    const id = recent.kind.slice(9);
    const cs = await getCampaigns();
    const camp = cs.find((x) => x.id === id);
    if (camp) {
      camp.stats.replied += 1;
      await saveCampaigns(cs);
    }
  }
}

export async function handleStatus(messageId: string, status: string, error?: string) {
  const map: Record<string, LogEntry["status"]> = { sent: "sent", delivered: "delivered", read: "read", failed: "failed" };
  const s = map[status.toLowerCase()];
  if (!s) return;
  const e = await updateLog(messageId, { status: s, ...(error ? { error } : {}) });
  if (e && e.kind.startsWith("campaign:") && (s === "delivered" || s === "read")) {
    const cs = await getCampaigns();
    const camp = cs.find((x) => x.id === e.kind.slice(9));
    if (camp) {
      if (s === "delivered") camp.stats.delivered += 1;
      if (s === "read") camp.stats.read += 1;
      await saveCampaigns(cs);
    }
  }
}

// ── Templates (list from the provider, submit new ones for approval) ──

export type TemplateInfo = { name: string; language: string; status: string; category: string; body: string; params: number; header?: string };

export async function listTemplates(): Promise<{ templates: TemplateInfo[]; error?: string }> {
  const p = provider();
  try {
    if (p === "none") return { templates: [], error: "Connect a WhatsApp provider first (see Setup)." };
    if (p === "wati") {
      const r = await fetch(`${process.env.WATI_API_URL!.replace(/\/$/, "")}/api/v1/getMessageTemplates?pageSize=200`, { headers: { Authorization: `Bearer ${process.env.WATI_API_TOKEN!.replace(/^Bearer\s+/i, "")}` } });
      const d = await r.json();
      return {
        templates: (d.messageTemplates ?? []).map((t: { elementName: string; language?: { value?: string }; status: string; category: string; body?: string; bodyOriginal?: string }) => ({
          name: t.elementName, language: t.language?.value ?? "en", status: t.status, category: t.category, body: t.bodyOriginal ?? t.body ?? "", params: ((t.bodyOriginal ?? t.body ?? "").match(/\{\{/g) ?? []).length,
        })),
      };
    }
    const url = p === "360dialog" ? `${D360}/v1/configs/templates?limit=500` : `${META}/${process.env.WHATSAPP_WABA_ID}/message_templates?limit=500`;
    const headers: Record<string, string> = p === "360dialog" ? { "D360-API-KEY": process.env.D360_API_KEY! } : { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };
    if (p === "meta" && !process.env.WHATSAPP_WABA_ID) return { templates: [], error: "Add WHATSAPP_WABA_ID in Vercel to list templates." };
    const r = await fetch(url, { headers });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error?.message || d?.meta?.developer_message || `Error ${r.status}`);
    const list = (d.data ?? d.waba_templates ?? []) as { name: string; language: string; status: string; category: string; components: { type: string; text?: string; format?: string }[] }[];
    return {
      templates: list.map((t) => {
        const body = t.components?.find((c) => c.type === "BODY" || c.type === "body")?.text ?? "";
        const header = t.components?.find((c) => c.type === "HEADER" || c.type === "header")?.format;
        return { name: t.name, language: t.language, status: t.status, category: t.category, body, params: (body.match(/\{\{\d+\}\}/g) ?? []).length, header };
      }),
    };
  } catch (e) {
    return { templates: [], error: (e as Error).message };
  }
}

export async function createTemplate(t: { name: string; category: string; language: string; body: string; example: string[]; header?: "IMAGE"; buttons?: string[] }) {
  const p = provider();
  if (p === "wati") throw new Error("With WATI, create templates in your WATI dashboard (Broadcast → Template messages). Copy the text from here.");
  if (p === "none") throw new Error("Connect a WhatsApp provider first.");
  const components: unknown[] = [];
  if (t.header === "IMAGE") components.push({ type: "HEADER", format: "IMAGE", example: { header_handle: ["https://cdn.shopify.com/s/files/1/0295/0545/4173/files/3614273863360.jpg"] } });
  components.push({ type: "BODY", text: t.body, ...(t.example.length ? { example: { body_text: [t.example] } } : {}) });
  if (t.buttons?.length) components.push({ type: "BUTTONS", buttons: t.buttons.map((text) => ({ type: "QUICK_REPLY", text })) });
  const payload = { name: t.name, category: t.category, language: t.language, allow_category_change: true, components };
  const r = p === "360dialog"
    ? await fetch(`${D360}/v1/configs/templates`, { method: "POST", headers: { "D360-API-KEY": process.env.D360_API_KEY!, "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    : await fetch(`${META}/${process.env.WHATSAPP_WABA_ID}/message_templates`, { method: "POST", headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.error_user_msg || d?.error?.message || d?.meta?.developer_message || `Error ${r.status}`);
  return d;
}

/** 360dialog: point the number's webhook at this shop. */
export async function register360Webhook(url: string) {
  const r = await fetch(`${D360}/v1/configs/webhook`, { method: "POST", headers: { "D360-API-KEY": process.env.D360_API_KEY!, "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
  if (!r.ok) throw new Error(`360dialog: ${r.status} ${await r.text()}`);
}
