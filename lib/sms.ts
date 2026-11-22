import "server-only";

import { db } from "@/lib/db";
import { fillSms, secretKeys, SMS_MASK, withSmsDefaults, type SmsConfig, type SmsEvent, type SmsProvider } from "@/lib/sms-config";
import { normPhone } from "@/lib/wa";

// Sends SMS through the provider chosen in Admin → SMS. Keys never leave the server.

export async function getSms(): Promise<SmsConfig> {
  try {
    const raw = await db.cmd<string | null>(["GET", "sms"]);
    return withSmsDefaults(raw ? JSON.parse(raw) : null);
  } catch {
    return withSmsDefaults(null);
  }
}

/** Save from the admin page: masked secrets keep their saved value. */
export async function saveSms(v: SmsConfig) {
  const old = await getSms();
  const creds = { ...old.creds };
  for (const [p, fields] of Object.entries(v.creds)) {
    const keep = old.creds[p] ?? {};
    creds[p] = { ...keep, ...Object.fromEntries(Object.entries(fields).map(([k, val]) => [k, val === SMS_MASK ? keep[k] ?? "" : val.trim()])) };
  }
  await db.cmd(["SET", "sms", JSON.stringify(withSmsDefaults({ ...v, creds }))]);
}

/** For the admin page: secrets replaced by dots. */
export async function maskedSms(): Promise<SmsConfig> {
  const s = await getSms();
  const creds: SmsConfig["creds"] = {};
  for (const [p, f] of Object.entries(s.creds)) {
    const secret = new Set(secretKeys(p as SmsProvider));
    creds[p] = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, secret.has(k) && v ? SMS_MASK : v]));
  }
  return { ...s, creds };
}

const e164 = (phone: string) => `+${normPhone(phone) || phone.replace(/\D/g, "")}`;
const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;
const form = (o: Record<string, string>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString();

export type SmsResult = { ok: boolean; id?: string; error?: string };

export async function sendSms(phone: string, text: string, cfg?: SmsConfig): Promise<SmsResult> {
  const s = cfg ?? (await getSms());
  const c = s.creds[s.provider] ?? {};
  const to = e164(phone);
  const from = s.senderId || "SuperYou";
  if (!s.provider) return { ok: false, error: "No SMS provider chosen" };
  if (to.length < 9) return { ok: false, error: "Invalid phone number" };
  const t = { signal: AbortSignal.timeout(10000) };
  try {
    switch (s.provider) {
      case "twilio": {
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(c.accountSid)}/Messages.json`, {
          ...t, method: "POST", headers: { Authorization: basic(c.accountSid, c.authToken), "Content-Type": "application/x-www-form-urlencoded" },
          body: form({ To: to, Body: text, ...(c.messagingServiceSid ? { MessagingServiceSid: c.messagingServiceSid } : { From: from }) }),
        });
        const j = (await r.json()) as { sid?: string; message?: string };
        return r.ok ? { ok: true, id: j.sid } : { ok: false, error: j.message ?? `Twilio ${r.status}` };
      }
      case "infobip": {
        const base = (c.baseUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
        const r = await fetch(`https://${base}/sms/2/text/advanced`, {
          ...t, method: "POST", headers: { Authorization: `App ${c.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ messages: [{ destinations: [{ to: to.slice(1) }], from, text }] }),
        });
        const j = (await r.json()) as { messages?: { messageId: string; status?: { groupName?: string; description?: string } }[]; requestError?: { serviceException?: { text?: string } } };
        const m = j.messages?.[0];
        return r.ok && m && m.status?.groupName !== "REJECTED" ? { ok: true, id: m.messageId } : { ok: false, error: m?.status?.description ?? j.requestError?.serviceException?.text ?? `Infobip ${r.status}` };
      }
      case "vonage": {
        const r = await fetch("https://rest.nexmo.com/sms/json", { ...t, method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ api_key: c.apiKey, api_secret: c.apiSecret, from, to: to.slice(1), text, type: /[^\u0000-ÿ]/.test(text) ? "unicode" : "text" }) });
        const j = (await r.json()) as { messages?: { status: string; "message-id"?: string; "error-text"?: string }[] };
        const m = j.messages?.[0];
        return m?.status === "0" ? { ok: true, id: m["message-id"] } : { ok: false, error: m?.["error-text"] ?? `Vonage ${r.status}` };
      }
      case "plivo": {
        const r = await fetch(`https://api.plivo.com/v1/Account/${encodeURIComponent(c.authId)}/Message/`, { ...t, method: "POST", headers: { Authorization: basic(c.authId, c.authToken), "Content-Type": "application/json" }, body: JSON.stringify({ src: from, dst: to.slice(1), text }) });
        const j = (await r.json()) as { message_uuid?: string[]; error?: string };
        return r.ok ? { ok: true, id: j.message_uuid?.[0] } : { ok: false, error: j.error ?? `Plivo ${r.status}` };
      }
      case "sinch": {
        const region = c.region === "eu" ? "eu" : "us";
        const r = await fetch(`https://${region}.sms.api.sinch.com/xms/v1/${encodeURIComponent(c.servicePlanId)}/batches`, { ...t, method: "POST", headers: { Authorization: `Bearer ${c.apiToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to.slice(1)], body: text }) });
        const j = (await r.json()) as { id?: string; text?: string };
        return r.ok ? { ok: true, id: j.id } : { ok: false, error: j.text ?? `Sinch ${r.status}` };
      }
      case "unifonic": {
        const r = await fetch("https://el.cloud.unifonic.com/rest/SMS/messages", { ...t, method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ AppSid: c.appSid, SenderID: from, Recipient: to.slice(1), Body: text }) });
        const j = (await r.json()) as { success?: boolean | string; message?: string; data?: { MessageID?: string | number } };
        return String(j.success) === "true" ? { ok: true, id: String(j.data?.MessageID ?? "") } : { ok: false, error: j.message ?? `Unifonic ${r.status}` };
      }
      case "smsto": {
        const r = await fetch("https://api.sms.to/sms/send", { ...t, method: "POST", headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ to, message: text, sender_id: from }) });
        const j = (await r.json()) as { success?: boolean; message_id?: string; message?: string };
        return j.success ? { ok: true, id: j.message_id } : { ok: false, error: j.message ?? `SMS.to ${r.status}` };
      }
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return { ok: false, error: "Unknown provider" };
}

/** Order texts. `whatsappSent` tells whether WhatsApp already reached the customer (fallback mode). */
export async function smsForOrder(event: SmsEvent, phone: string, vars: Record<string, string>, whatsappSent: boolean) {
  const s = await getSms();
  if (!s.enabled || !s.provider) return;
  const ev = s.events[event];
  if (!ev?.enabled || !ev.text.trim()) return;
  if (s.mode === "fallback" && whatsappSent) return;
  const r = await sendSms(phone, fillSms(ev.text, vars).slice(0, 480), s);
  await db.cmd(["LPUSH", "sms:log", JSON.stringify({ at: new Date().toISOString(), to: phone, event, ok: r.ok, error: r.error, provider: s.provider })]).catch(() => {});
  await db.cmd(["LTRIM", "sms:log", 0, 199]).catch(() => {});
  if (!r.ok) console.error("[sms]", event, r.error);
}

export async function smsLog(n = 30): Promise<{ at: string; to: string; event: string; ok: boolean; error?: string; provider: string }[]> {
  try {
    return ((await db.cmd<string[]>(["LRANGE", "sms:log", 0, n - 1])) ?? []).map((x) => JSON.parse(x));
  } catch {
    return [];
  }
}
