import { z } from "zod";

// SMS settings (Admin → SMS). Client-safe: types, providers, defaults, validation.
// The calls themselves are in lib/sms.ts (server only).

export type SmsProvider = "" | "twilio" | "infobip" | "vonage" | "plivo" | "sinch" | "unifonic" | "smsto";

export const SMS_PROVIDERS: { id: SmsProvider; name: string; about: string; signup: string; fields: { k: string; label: string; ph?: string; secret?: boolean }[] }[] = [
  { id: "twilio", name: "Twilio", about: "Global leader, very reliable, detailed delivery reports. About $0.36 per SMS to Lebanon.", signup: "https://console.twilio.com/",
    fields: [{ k: "accountSid", label: "Account SID", ph: "ACxxxxxxxx" }, { k: "authToken", label: "Auth token", secret: true }, { k: "messagingServiceSid", label: "Messaging Service SID (optional)", ph: "MGxxxxxxxx" }] },
  { id: "infobip", name: "Infobip", about: "Strong in the Middle East, direct operator routes. Price on quote.", signup: "https://portal.infobip.com/",
    fields: [{ k: "baseUrl", label: "Your API base URL", ph: "xxxxx.api.infobip.com" }, { k: "apiKey", label: "API key", secret: true }] },
  { id: "vonage", name: "Vonage (Nexmo)", about: "Simple pay-as-you-go SMS API.", signup: "https://dashboard.nexmo.com/",
    fields: [{ k: "apiKey", label: "API key" }, { k: "apiSecret", label: "API secret", secret: true }] },
  { id: "plivo", name: "Plivo", about: "Lower price, about $0.23 per SMS to Lebanon.", signup: "https://console.plivo.com/",
    fields: [{ k: "authId", label: "Auth ID" }, { k: "authToken", label: "Auth token", secret: true }] },
  { id: "sinch", name: "Sinch", about: "Large operator network, about $0.25 per SMS.", signup: "https://dashboard.sinch.com/",
    fields: [{ k: "servicePlanId", label: "Service plan ID" }, { k: "apiToken", label: "API token", secret: true }, { k: "region", label: "Region", ph: "us or eu" }] },
  { id: "unifonic", name: "Unifonic", about: "Middle East provider (Saudi-based), Arabic support.", signup: "https://console.unifonic.com/",
    fields: [{ k: "appSid", label: "App SID", secret: true }] },
  { id: "smsto", name: "SMS.to", about: "Simple prepaid SMS API, covers Alfa and touch.", signup: "https://sms.to/",
    fields: [{ k: "apiKey", label: "API key", secret: true }] },
];

export const SMS_EVENTS = {
  orderPlaced: { label: "Order received", text: "SuperYou: thanks {first_name}! Order {order_id} ({total}) is confirmed. Track it: {link}" },
  orderConfirmed: { label: "Order confirmed", text: "SuperYou: order {order_id} is confirmed and being prepared." },
  orderShipped: { label: "Order shipped", text: "SuperYou: order {order_id} is on its way with {courier}. Track: {tracking_link}" },
  orderDelivered: { label: "Order delivered", text: "SuperYou: order {order_id} was delivered. Enjoy! Questions? Reply on WhatsApp." },
  subscriptionStarted: { label: "Subscription started", text: "SuperYou: your subscription is set ({every}), next order {next_date}. Your discount unlocks after {deliveries} deliveries, with {percent}% back on them. Manage: {link}" },
  subscriptionUnlocked: { label: "Subscription discount unlocked", text: "SuperYou: {percent}% off is unlocked on your subscription! {rebate} rebate comes off your next delivery on {next_date}. {link}" },
} as const;
export type SmsEvent = keyof typeof SMS_EVENTS;

export type SmsConfig = {
  enabled: boolean;
  provider: SmsProvider;
  senderId: string; // alphanumeric, e.g. SuperYou (max 11 characters)
  mode: "fallback" | "always"; // fallback: only when the WhatsApp message didn't go out
  creds: Record<string, Record<string, string>>; // per provider
  events: Record<SmsEvent, { enabled: boolean; text: string }>;
};

export const defaultSms: SmsConfig = {
  enabled: false,
  provider: "",
  senderId: "SuperYou",
  mode: "fallback",
  creds: {},
  events: Object.fromEntries(Object.entries(SMS_EVENTS).map(([k, v]) => [k, { enabled: k !== "orderConfirmed", text: v.text }])) as SmsConfig["events"],
};

export function withSmsDefaults(v: Partial<SmsConfig> | null | undefined): SmsConfig {
  return {
    ...defaultSms, ...(v ?? {}),
    creds: { ...(v?.creds ?? {}) },
    events: Object.fromEntries(Object.keys(SMS_EVENTS).map((k) => [k, { ...defaultSms.events[k as SmsEvent], ...(v?.events?.[k as SmsEvent] ?? {}) }])) as SmsConfig["events"],
  };
}

export const SMS_MASK = "••••••••";
export const secretKeys = (p: SmsProvider) => SMS_PROVIDERS.find((x) => x.id === p)?.fields.filter((f) => f.secret).map((f) => f.k) ?? [];

export const smsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(["", "twilio", "infobip", "vonage", "plivo", "sinch", "unifonic", "smsto"]),
  senderId: z.string().trim().max(11).regex(/^[A-Za-z0-9 ]*$/, "Sender name: up to 11 letters or digits"),
  mode: z.enum(["fallback", "always"]),
  creds: z.record(z.string(), z.record(z.string(), z.string().max(1000))),
  events: z.record(z.string(), z.object({ enabled: z.boolean(), text: z.string().max(480) })),
});

/** Fill {placeholders} from order details. */
export const fillSms = (t: string, vars: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
