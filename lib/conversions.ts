import "server-only";

import { createHash } from "node:crypto";
import type { Order } from "@/lib/orders";
import { getMarketing } from "@/lib/site-store";
import { siteUrl } from "@/lib/site-url";

// Server-side purchase events (Meta Conversions API, TikTok Events API). They carry the order number
// as event id, the same id the browser tag sends, so each platform counts the sale once.
// Customer details are sent hashed (SHA-256), never in clear.

const sha = (v?: string) => (v ? createHash("sha256").update(v.trim().toLowerCase()).digest("hex") : undefined);
const phoneE164 = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.startsWith("961") ? d : d.length <= 8 ? `961${d.replace(/^0/, "")}` : d;
};

export type ClientCtx = { ip?: string; ua?: string; fbp?: string; fbc?: string; ttp?: string; url?: string };

export async function sendServerConversions(order: Order, ctx: ClientCtx) {
  const m = await getMarketing();
  const t = m.tracking;
  const value = order.total + (order.giftCard?.amount ?? 0);
  const paid = order.lines.filter((l) => !l.gift);
  const when = Math.floor(Date.parse(order.createdAt) / 1000);
  const ph = sha(phoneE164(order.customer.phone));
  const em = sha(order.customer.email || undefined);
  const url = ctx.url || `${siteUrl()}/checkout/`;
  const jobs: Promise<unknown>[] = [];

  if (t.metaPixel && t.metaToken) {
    const fbc = ctx.fbc || (order.attribution?.fbclid ? `fb.1.${Date.parse(order.attribution.at ?? order.createdAt)}.${order.attribution.fbclid}` : undefined);
    const body = {
      data: [{
        event_name: "Purchase", event_time: when, event_id: order.id, action_source: "website", event_source_url: url,
        user_data: { ph: ph ? [ph] : undefined, em: em ? [em] : undefined, fn: [sha(order.customer.firstName)], ln: [sha(order.customer.lastName)], ct: [sha(order.customer.city.replace(/\s/g, ""))], country: [sha("lb")], client_ip_address: ctx.ip, client_user_agent: ctx.ua, fbp: ctx.fbp, fbc },
        custom_data: { currency: "USD", value, order_id: order.id, content_type: "product", content_ids: paid.map((l) => l.productId), num_items: paid.reduce((s, l) => s + l.qty, 0) },
      }],
      ...(t.metaTestCode ? { test_event_code: t.metaTestCode } : {}),
    };
    jobs.push(post(`https://graph.facebook.com/v21.0/${t.metaPixel}/events?access_token=${encodeURIComponent(t.metaToken)}`, body, {}, "meta"));
  }

  if (t.tiktokPixel && t.tiktokToken) {
    const body = {
      event_source: "web", event_source_id: t.tiktokPixel,
      data: [{
        event: "PlaceAnOrder", event_time: when, event_id: order.id,
        user: { phone: ph, email: em, ip: ctx.ip, user_agent: ctx.ua, ttp: ctx.ttp, ttclid: order.attribution?.ttclid },
        page: { url },
        properties: { currency: "USD", value, content_type: "product", order_id: order.id, contents: paid.map((l) => ({ content_id: l.productId, content_name: l.name, price: l.unitPrice, quantity: l.qty })) },
      }],
    };
    jobs.push(post("https://business-api.tiktok.com/open_api/v1.3/event/track/", body, { "Access-Token": t.tiktokToken }, "tiktok"));
  }
  await Promise.all(jobs);
}

async function post(url: string, body: unknown, headers: Record<string, string>, who: string) {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
    if (!r.ok) console.error(`[conversions:${who}]`, r.status, (await r.text()).slice(0, 300));
  } catch (e) {
    console.error(`[conversions:${who}]`, (e as Error).message);
  }
}
