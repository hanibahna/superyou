// WhatsApp messaging: types, defaults, validation and helpers. Client-safe (no secrets here —
// the access token and IDs live in Vercel environment variables).

import { z } from "zod";

/** Normalise a phone number to WhatsApp's international digits (Lebanon by default). */
export function normPhone(raw: string, country = "961"): string {
  let d = (raw || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = country + d.slice(1);
  else if (d.length <= 8) d = country + d; // local Lebanese number without the leading 0 (e.g. 70777608)
  return /^\d{8,15}$/.test(d) ? d : "";
}

// ── Contacts ─────────────────────────────────────────────

export type Contact = {
  phone: string; // international digits, e.g. 96170777608
  name: string;
  email: string;
  updates: boolean; // order / booking messages
  offers: boolean; // marketing opt-in
  optInAt?: string;
  optOutAt?: string;
  sources: string[]; // checkout, booking, newsletter, import, manual
  tags: string[];
  orders: number;
  spent: number;
  lastOrderAt?: string;
  brands: string[]; // brands bought
  categories: string[]; // categories bought
  services: string[]; // services booked / events joined
  lastInboundAt?: string; // last message from the customer (24-hour reply window)
  createdAt: string;
};

// ── Automations ─────────────────────────────────────────

export type AutomationKey = "orderPlaced" | "orderConfirmed" | "orderShipped" | "orderDelivered" | "bookingReceived" | "bookingConfirmed" | "bookingReminder" | "welcomeOptIn" | "welcomeCode" | "reviewRequest" | "reorderReminder" | "clubReward" | "birthday" | "cartReminder" | "giftCardSent";

export type Automation = {
  enabled: boolean;
  template: string; // approved template name in Meta
  language: string; // e.g. en, ar
  params: string[]; // body variables in order, using {{tokens}} like {{first_name}}
};

export const automationInfo: Record<AutomationKey, { label: string; when: string; tokens: string[]; category: "UTILITY" | "MARKETING" }> = {
  orderPlaced: { label: "Order received", when: "As soon as a customer places an order", tokens: ["first_name", "order_id", "total", "items", "link"], category: "UTILITY" },
  orderConfirmed: { label: "Order confirmed", when: "When you set an order to Confirmed", tokens: ["first_name", "order_id", "total", "link"], category: "UTILITY" },
  orderShipped: { label: "Order on its way", when: "When you set an order to Shipped", tokens: ["first_name", "order_id", "link", "courier", "tracking", "tracking_link"], category: "UTILITY" },
  orderDelivered: { label: "Order delivered", when: "When you set an order to Delivered", tokens: ["first_name", "order_id"], category: "UTILITY" },
  bookingReceived: { label: "Booking received", when: "When someone books a service or signs up for an event", tokens: ["first_name", "service", "date", "time"], category: "UTILITY" },
  bookingConfirmed: { label: "Booking confirmed", when: "When you set a booking to Confirmed", tokens: ["first_name", "service", "date", "time"], category: "UTILITY" },
  bookingReminder: { label: "Appointment reminder", when: "The day before (sent each morning around 10:00)", tokens: ["first_name", "service", "date", "time"], category: "UTILITY" },
  welcomeOptIn: { label: "Welcome to offers", when: "When someone first opts in to WhatsApp offers", tokens: ["first_name"], category: "MARKETING" },
  welcomeCode: { label: "Welcome discount code", when: "When someone signs up through the pop-up with their WhatsApp number", tokens: ["first_name", "code", "percent", "days"], category: "MARKETING" },
  reviewRequest: { label: "Review request", when: "A day after an order is set to Delivered", tokens: ["first_name", "order_id", "link"], category: "MARKETING" },
  reorderReminder: { label: "Time to restock", when: "When a product bought earlier is likely running out", tokens: ["first_name", "product", "link"], category: "MARKETING" },
  clubReward: { label: "Club reward voucher", when: "When a member's points turn into a voucher", tokens: ["first_name", "code", "value", "points"], category: "MARKETING" },
  birthday: { label: "Birthday gift", when: "On the member's birthday (morning)", tokens: ["first_name", "code", "percent"], category: "MARKETING" },
  giftCardSent: { label: "Gift card received", when: "When a gift card bought on the site is paid — sent to the person receiving it", tokens: ["first_name", "from", "amount", "code", "message", "link"], category: "UTILITY" },
  cartReminder: { label: "Forgot something? (abandoned cart)", when: "A few hours after someone leaves checkout without ordering (only if they ticked WhatsApp offers)", tokens: ["first_name", "items", "total", "link"], category: "MARKETING" },
};

export type WaConfig = {
  live: boolean; // false = test mode: messages are logged, not sent
  testPhone: string; // your own number for test sends
  automations: Record<AutomationKey, Automation>;
};

const auto = (template: string, params: string[], enabled = true): Automation => ({ enabled, template, language: "en", params });

export const defaultWaConfig: WaConfig = {
  live: false,
  testPhone: "96170777608",
  automations: {
    orderPlaced: auto("order_received", ["{{first_name}}", "{{order_id}}", "{{total}}"]),
    orderConfirmed: auto("order_confirmed", ["{{first_name}}", "{{order_id}}"], false),
    orderShipped: auto("order_shipped", ["{{first_name}}", "{{order_id}}"]),
    orderDelivered: auto("order_delivered", ["{{first_name}}", "{{order_id}}"]),
    bookingReceived: auto("booking_received", ["{{first_name}}", "{{service}}", "{{date}}", "{{time}}"]),
    bookingConfirmed: auto("booking_confirmed", ["{{first_name}}", "{{service}}", "{{date}}", "{{time}}"]),
    bookingReminder: auto("booking_reminder", ["{{first_name}}", "{{service}}", "{{time}}"]),
    welcomeOptIn: auto("welcome_offers", ["{{first_name}}"], false),
    welcomeCode: auto("welcome_code", ["{{first_name}}", "{{percent}}", "{{code}}", "{{days}}"]),
    reviewRequest: auto("review_request", ["{{first_name}}", "{{order_id}}", "{{link}}"]),
    reorderReminder: auto("restock_reminder", ["{{first_name}}", "{{product}}", "{{link}}"]),
    clubReward: auto("club_reward", ["{{first_name}}", "{{value}}", "{{code}}"]),
    birthday: auto("birthday_gift", ["{{first_name}}", "{{percent}}", "{{code}}"]),
    cartReminder: auto("cart_reminder", ["{{first_name}}", "{{link}}"]),
    giftCardSent: auto("gift_card_received", ["{{first_name}}", "{{from}}", "{{amount}}", "{{code}}"]),
  },
};

const automationSchema = z.object({ enabled: z.boolean(), template: z.string().regex(/^[a-z0-9_]*$/, "Template names use lowercase letters, numbers and _").max(512), language: z.string().max(10), params: z.array(z.string().max(200)).max(10) });
export const waConfigSchema = z.object({
  live: z.boolean(),
  testPhone: z.string().max(20),
  automations: z.object(Object.fromEntries((Object.keys(automationInfo) as AutomationKey[]).map((k) => [k, automationSchema])) as Record<AutomationKey, typeof automationSchema>),
});

/** Ready-to-submit templates (create them in one click from the admin, then wait for Meta's approval). */
export const templatePresets: { name: string; category: "UTILITY" | "MARKETING"; body: string; example: string[]; header?: "IMAGE" }[] = [
  { name: "order_received", category: "UTILITY", body: "Hi {{1}}, thank you for your order {{2}} at SuperYou! Total: {{3}}. We'll let you know as soon as it's on its way.", example: ["Rana", "SUP-M3K2Q", "$45.90"] },
  { name: "order_confirmed", category: "UTILITY", body: "Hi {{1}}, your SuperYou order {{2}} is confirmed and being prepared.", example: ["Rana", "SUP-M3K2Q"] },
  { name: "order_shipped", category: "UTILITY", body: "Good news {{1}}! Your SuperYou order {{2}} is on its way. Our driver will call you before arriving.", example: ["Rana", "SUP-M3K2Q"] },
  { name: "order_delivered", category: "UTILITY", body: "Hi {{1}}, your SuperYou order {{2}} has been delivered. Enjoy! Reply to this message if you need anything.", example: ["Rana", "SUP-M3K2Q"] },
  { name: "booking_received", category: "UTILITY", body: "Hi {{1}}, we received your request for {{2}} on {{3}} at {{4}}. We'll confirm shortly.", example: ["Rana", "Free skin diagnosis", "Tue 24 Nov", "15:30"] },
  { name: "booking_confirmed", category: "UTILITY", body: "Hi {{1}}, your {{2}} on {{3}} at {{4}} is confirmed. See you at SuperYou!", example: ["Rana", "Free skin diagnosis", "Tue 24 Nov", "15:30"] },
  { name: "booking_reminder", category: "UTILITY", body: "Reminder: {{1}}, your {{2}} is tomorrow at {{3}}. Reply if you need to change it.", example: ["Rana", "Free skin diagnosis", "15:30"] },
  { name: "welcome_offers", category: "MARKETING", body: "Welcome to SuperYou on WhatsApp, {{1}}! You'll be first to hear about offers and new arrivals. Reply STOP anytime to unsubscribe.", example: ["Rana"] },
  { name: "welcome_code", category: "MARKETING", body: "Welcome to SuperYou, {{1}}! Here is your {{2}}% welcome code: {{3}}. Use it at checkout within {{4}} days.\n\nReply STOP to unsubscribe.", example: ["Rana", "10", "HELLO-7KQ2", "14"] },
  { name: "review_request", category: "MARKETING", body: "Hi {{1}}, how are you finding your SuperYou order {{2}}? Rate your products in 30 seconds: {{3}}\n\nReply STOP to unsubscribe.", example: ["Rana", "SUP-M3K2Q", "https://shopsuperyou.com/review/?o=SUP-M3K2Q"] },
  { name: "restock_reminder", category: "MARKETING", body: "Hi {{1}}, running low on {{2}}? Reorder in one tap: {{3}}\n\nReply STOP to unsubscribe.", example: ["Rana", "La Roche-Posay Effaclar Duo+", "https://shopsuperyou.com/products/effaclar-duo/"] },
  { name: "club_reward", category: "MARKETING", body: "Congratulations {{1}}! Your SuperYou Club points earned you a {{2}} voucher: {{3}}. Use it on your next order.", example: ["Rana", "$10", "CLUB-4H8K"] },
  { name: "birthday_gift", category: "MARKETING", body: "Happy birthday {{1}}! Enjoy {{2}}% off with code {{3}}, valid for 7 days. With love, SuperYou.", example: ["Rana", "15", "BDAY-2M7P"] },
  { name: "gift_card_received", category: "UTILITY", body: "Hi {{1}}, {{2}} sent you a SuperYou gift card worth {{3}}! Your code is {{4}}. Type it in the discount box at checkout on shopsuperyou.com.", example: ["Rana", "Maya Haddad", "$50.00", "GC-7KQ2-M4PX"] },
  { name: "cart_reminder", category: "MARKETING", body: "Hi {{1}}, you left some favourites in your SuperYou bag. They're saved for you here: {{2}}\n\nReply STOP to unsubscribe.", example: ["Rana", "https://shopsuperyou.com/cart/?restore=abc123"] },
  { name: "black_friday_2026", category: "MARKETING", header: "IMAGE", body: "Hi {{1}}, Black Friday is here! Up to 70% off skin care, make up and fragrance until 30 November. Shop now: {{2}}\n\nReply STOP to unsubscribe.", example: ["Rana", "https://shopsuperyou.com/collections/value-deals/"] },
  { name: "new_arrivals", category: "MARKETING", header: "IMAGE", body: "Hi {{1}}, new at SuperYou: {{2}}. Discover it here: {{3}}\n\nReply STOP to unsubscribe.", example: ["Rana", "the new La Roche-Posay serum", "https://shopsuperyou.com/"] },
  { name: "personal_offer", category: "MARKETING", body: "Hi {{1}}, a little thank-you: use code {{2}} for {{3}} off your next order at SuperYou. Valid until {{4}}.\n\nReply STOP to unsubscribe.", example: ["Rana", "THANKYOU10", "10%", "31 December"] },
];

// ── Lists (segments) and campaigns ──────────────────────

export type Segment = {
  id: string;
  name: string;
  rules: {
    minSpent: number;
    minOrders: number;
    brands: string[]; // bought any of these brands
    categories: string[]; // bought in any of these categories
    services: string[]; // booked any of these services / events
    sources: string[]; // joined via
    tags: string[];
    boughtWithinDays: number; // 0 = any
    notBoughtForDays: number; // 0 = any (win-back lists)
  };
};

export type Campaign = {
  id: string;
  name: string;
  segmentId: string; // "" = everyone opted in
  template: string;
  language: string;
  params: string[]; // body variables; {{first_name}} is personalised
  headerImage: string; // for templates with an image header
  status: "draft" | "sending" | "sent";
  createdAt: string;
  sentAt?: string;
  stats: { targeted: number; sent: number; failed: number; delivered: number; read: number; replied: number };
  cursor: number; // progress while sending
};

export const emptyRules = (): Segment["rules"] => ({ minSpent: 0, minOrders: 0, brands: [], categories: [], services: [], sources: [], tags: [], boughtWithinDays: 0, notBoughtForDays: 0 });

export const segmentSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  rules: z.object({
    minSpent: z.number().min(0), minOrders: z.number().int().min(0), brands: z.array(z.string().max(80)).max(100), categories: z.array(z.string().max(80)).max(50),
    services: z.array(z.string().max(80)).max(50), sources: z.array(z.string().max(30)).max(10), tags: z.array(z.string().max(40)).max(50),
    boughtWithinDays: z.number().int().min(0).max(3650), notBoughtForDays: z.number().int().min(0).max(3650),
  }),
});

export function inSegment(c: Contact, r: Segment["rules"], now = Date.now()): boolean {
  if (c.spent < r.minSpent || c.orders < r.minOrders) return false;
  const any = (want: string[], have: string[]) => !want.length || want.some((w) => have.some((h) => h.toLowerCase() === w.toLowerCase()));
  if (!any(r.brands, c.brands) || !any(r.categories, c.categories) || !any(r.services, c.services) || !any(r.sources, c.sources) || !any(r.tags, c.tags)) return false;
  const last = c.lastOrderAt ? Date.parse(c.lastOrderAt) : 0;
  if (r.boughtWithinDays && (!last || now - last > r.boughtWithinDays * 86400_000)) return false;
  if (r.notBoughtForDays && last && now - last < r.notBoughtForDays * 86400_000) return false;
  return true;
}

export type LogEntry = {
  id: string; // WhatsApp message id (or local id in test mode)
  to: string;
  name: string;
  template: string;
  text: string; // preview of what was sent
  kind: string; // automation key, campaign id, test, reply
  status: "test" | "queued" | "sent" | "delivered" | "read" | "failed" | "received";
  error?: string;
  at: string;
};

/** Replace {{tokens}} in a parameter. */
export const fill = (s: string, vars: Record<string, string>) => s.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
