"use client";

// Shop events sent to whichever ad platforms are set up in Admin → Campaigns & ads.
// Each call is a no-op for platforms whose tag isn't loaded.

import type { Attribution } from "@/lib/marketing";

type Item = { id: string; name: string; brand?: string; price: number; qty?: number };
type W = Window & { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void; ttq?: { track: (e: string, d?: object, o?: object) => void }; snaptr?: (...a: unknown[]) => void; __syAds?: { googleAds?: string; label?: string } };

const w = () => (typeof window === "undefined" ? null : (window as W));
const CUR = "USD";

export type ShopEvent =
  | { type: "view_item"; item: Item }
  | { type: "add_to_cart"; item: Item }
  | { type: "begin_checkout"; items: Item[]; value: number }
  | { type: "purchase"; orderId: string; items: Item[]; value: number };

export function track(e: ShopEvent) {
  const win = w();
  if (!win) return;
  try {
    const items = "items" in e ? e.items : [e.item];
    const value = "value" in e ? e.value : e.item.price * (e.item.qty ?? 1);
    const ga = items.map((i) => ({ item_id: i.id, item_name: i.name, item_brand: i.brand, price: i.price, quantity: i.qty ?? 1 }));
    const ids = items.map((i) => i.id);
    const contents = items.map((i) => ({ content_id: i.id, content_name: i.name, price: i.price, quantity: i.qty ?? 1 }));
    const eventId = e.type === "purchase" ? e.orderId : undefined; // same id as the server event, so platforms count it once
    const gaName = e.type;
    const meta = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "Purchase" }[e.type];
    const tt = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "PlaceAnOrder" }[e.type];
    const snap = { view_item: "VIEW_CONTENT", add_to_cart: "ADD_CART", begin_checkout: "START_CHECKOUT", purchase: "PURCHASE" }[e.type];

    win.gtag?.("event", gaName, { currency: CUR, value, items: ga, ...(eventId ? { transaction_id: eventId } : {}) });
    if (e.type === "purchase" && win.__syAds?.googleAds && win.__syAds.label)
      win.gtag?.("event", "conversion", { send_to: `${win.__syAds.googleAds}/${win.__syAds.label}`, value, currency: CUR, transaction_id: e.orderId });
    win.fbq?.("track", meta, { content_ids: ids, content_type: "product", value, currency: CUR, num_items: items.length }, eventId ? { eventID: eventId } : undefined);
    win.ttq?.track(tt, { contents, content_type: "product", value, currency: CUR }, eventId ? { event_id: eventId } : undefined);
    win.snaptr?.("track", snap, { item_ids: ids, price: value, currency: CUR, number_items: items.length, ...(eventId ? { transaction_id: eventId } : {}) });
  } catch {
    // tracking must never break the shop
  }
}

const KEY = "sy:utm";
/** Remembers where the visitor came from (last campaign click wins, kept 30 days) for the order. */
export function captureAttribution() {
  const win = w();
  if (!win) return;
  try {
    const p = new URLSearchParams(win.location.search);
    const a: Attribution = {
      source: p.get("utm_source") ?? undefined, medium: p.get("utm_medium") ?? undefined, campaign: p.get("utm_campaign") ?? undefined,
      content: p.get("utm_content") ?? undefined, term: p.get("utm_term") ?? undefined,
      gclid: p.get("gclid") ?? undefined, fbclid: p.get("fbclid") ?? undefined, ttclid: p.get("ttclid") ?? undefined,
    };
    const tagged = Object.values(a).some(Boolean);
    const ext = document.referrer && !document.referrer.startsWith(win.location.origin);
    if (!tagged && !(ext && !localStorage.getItem(KEY))) return;
    if (!tagged) a.source = new URL(document.referrer).hostname.replace(/^www\./, "");
    a.landing = win.location.pathname;
    a.referrer = document.referrer ? document.referrer.slice(0, 300) : undefined;
    a.at = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    // private mode etc.
  }
}

export function readAttribution(): Attribution | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const a = JSON.parse(raw) as Attribution;
    if (a.at && Date.now() - Date.parse(a.at) > 30 * 864e5) return undefined;
    const clean: Attribution = {};
    for (const [k, v] of Object.entries(a)) if (typeof v === "string" && v) (clean as Record<string, string>)[k] = v.slice(0, k === "fbclid" ? 300 : k === "landing" || k === "referrer" ? 300 : 200);
    return clean;
  } catch {
    return undefined;
  }
}
