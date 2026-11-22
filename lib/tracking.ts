import "server-only";

import { db } from "@/lib/db";
import type { Order } from "@/lib/orders";

// Live shipment tracking from the couriers' own systems (Admin → Operations → Couriers → Live tracking).
// Keys live on the server only. Orders shipped with a courier that has live tracking get their
// status and scan history refreshed when the customer opens the order, from the admin, and daily.

import type { TrackApi } from "@/lib/tracking-apis";
export type { TrackApi };

export type TrackKeys = {
  aramex: { username: string; password: string; accountNumber: string; accountPin: string; accountEntity: string; accountCountryCode: string };
  dhl: { apiKey: string };
  track17: { apiKey: string };
};
export const defaultTrackKeys: TrackKeys = {
  aramex: { username: "", password: "", accountNumber: "", accountPin: "", accountEntity: "BEY", accountCountryCode: "LB" },
  dhl: { apiKey: "" },
  track17: { apiKey: "" },
};

export type TrackStatus = "pending" | "in_transit" | "out_for_delivery" | "delivered" | "exception";
export type TrackEvent = { at: string; text: string; place?: string };
export type TrackResult = { status: TrackStatus; events: TrackEvent[] };

export async function getTrackKeys(): Promise<TrackKeys> {
  try {
    const raw = await db.cmd<string | null>(["GET", "tracking-keys"]);
    const v = raw ? (JSON.parse(raw) as Partial<TrackKeys>) : {};
    return { aramex: { ...defaultTrackKeys.aramex, ...v.aramex }, dhl: { ...defaultTrackKeys.dhl, ...v.dhl }, track17: { ...defaultTrackKeys.track17, ...v.track17 } };
  } catch {
    return defaultTrackKeys;
  }
}
export const TRACK_SECRETS: [keyof TrackKeys, string][] = [["aramex", "password"], ["aramex", "accountPin"], ["dhl", "apiKey"], ["track17", "apiKey"]];
/** For the admin page: secrets masked. */
export async function maskedKeys(): Promise<TrackKeys> {
  const { MASK } = await import("@/lib/marketing");
  const k = structuredClone(await getTrackKeys());
  for (const [g, f] of TRACK_SECRETS) if ((k[g] as Record<string, string>)[f]) (k[g] as Record<string, string>)[f] = MASK;
  return k;
}
export async function saveTrackKeys(k: TrackKeys) {
  await db.cmd(["SET", "tracking-keys", JSON.stringify(k)]);
}

const classify = (s: string): TrackStatus => {
  const t = s.toLowerCase();
  if (/deliver(ed|y completed)|signed|collected by consignee|livr/.test(t) && !/attempt|out for|not delivered|undeliver/.test(t)) return "delivered";
  if (/out for delivery|with (courier|delivery agent)|on vehicle/.test(t)) return "out_for_delivery";
  if (/exception|fail|attempt|return|held|hold|refused|incorrect address|delay/.test(t)) return "exception";
  if (/pick ?up|picked|received|transit|depart|arriv|process|clearance|customs|forwarded|sort/.test(t)) return "in_transit";
  return "pending";
};

async function aramex(no: string, k: TrackKeys["aramex"]): Promise<TrackResult> {
  const r = await fetch("https://ws.aramex.net/ShippingAPI.V2/Tracking/Service_1_0.svc/json/TrackShipments", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      ClientInfo: { UserName: k.username, Password: k.password, Version: "v1.0", AccountNumber: k.accountNumber, AccountPin: k.accountPin, AccountEntity: k.accountEntity, AccountCountryCode: k.accountCountryCode, Source: 24 },
      Shipments: [no], GetLastTrackingUpdateOnly: false,
    }),
  });
  const j = (await r.json()) as { HasErrors?: boolean; Notifications?: { Message: string }[]; TrackingResults?: { Key: string; Value: { UpdateDescription: string; UpdateLocation: string; UpdateDateTime: string }[] }[] };
  if (j.HasErrors) throw new Error(j.Notifications?.[0]?.Message ?? "Aramex error");
  const rows = j.TrackingResults?.[0]?.Value ?? [];
  const at = (d: string) => { const m = /\/Date\((\d+)/.exec(d); return m ? new Date(Number(m[1])).toISOString() : d; };
  const events = rows.map((e) => ({ at: at(e.UpdateDateTime), text: e.UpdateDescription, place: e.UpdateLocation })).sort((a, b) => b.at.localeCompare(a.at));
  return { status: events[0] ? classify(events[0].text) : "pending", events };
}

async function dhl(no: string, k: TrackKeys["dhl"]): Promise<TrackResult> {
  const r = await fetch(`https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(no)}`, { headers: { "DHL-API-Key": k.apiKey, Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  if (r.status === 404) return { status: "pending", events: [] };
  if (!r.ok) throw new Error(`DHL ${r.status}`);
  const j = (await r.json()) as { shipments?: { status?: { statusCode?: string }; events?: { timestamp: string; description?: string; status?: string; location?: { address?: { addressLocality?: string } } }[] }[] };
  const s = j.shipments?.[0];
  const events = (s?.events ?? []).map((e) => ({ at: e.timestamp, text: e.description || e.status || "", place: e.location?.address?.addressLocality }));
  const code = s?.status?.statusCode ?? "";
  const status: TrackStatus = code === "delivered" ? "delivered" : code === "failure" ? "exception" : code === "transit" ? (events[0] && classify(events[0].text) === "out_for_delivery" ? "out_for_delivery" : "in_transit") : "pending";
  return { status, events };
}

async function track17(no: string, k: TrackKeys["track17"]): Promise<TrackResult> {
  const h = { "Content-Type": "application/json", "17token": k.apiKey };
  // Register once (ignored if already registered), then read.
  await fetch("https://api.17track.net/track/v2.2/register", { method: "POST", headers: h, body: JSON.stringify([{ number: no }]), signal: AbortSignal.timeout(10000) }).catch(() => {});
  const r = await fetch("https://api.17track.net/track/v2.2/gettrackinfo", { method: "POST", headers: h, body: JSON.stringify([{ number: no }]), signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`17TRACK ${r.status}`);
  const j = (await r.json()) as { data?: { accepted?: { track_info?: { latest_status?: { status?: string }; tracking?: { providers?: { events?: { time_iso?: string; time_utc?: string; description?: string; location?: string }[] }[] } } }[] } };
  const info = j.data?.accepted?.[0]?.track_info;
  const events = (info?.tracking?.providers?.[0]?.events ?? []).map((e) => ({ at: e.time_iso || e.time_utc || "", text: e.description ?? "", place: e.location || undefined }));
  const st = info?.latest_status?.status ?? "";
  const status: TrackStatus = st === "Delivered" ? "delivered" : st === "OutForDelivery" ? "out_for_delivery" : /Exception|DeliveryFailure|Expired/.test(st) ? "exception" : /InTransit|AvailableForPickup|InfoReceived/.test(st) ? "in_transit" : "pending";
  return { status, events };
}

export async function fetchTracking(api: TrackApi, no: string): Promise<TrackResult | null> {
  if (!api || !no) return null;
  const k = await getTrackKeys();
  if (api === "aramex" && k.aramex.username && k.aramex.accountNumber) return aramex(no, k.aramex);
  if (api === "dhl" && k.dhl.apiKey) return dhl(no, k.dhl);
  if (api === "track17" && k.track17.apiKey) return track17(no, k.track17);
  return null;
}

/** Refresh one order's shipment from the courier (at most every `minMinutes`). Marks it Delivered when the courier says so. */
export async function refreshShipment(order: Order, minMinutes = 60): Promise<Order> {
  const s = order.shipment;
  if (!s?.tracking || order.status === "delivered" || order.status === "cancelled" || order.status === "returned") return order;
  if (s.checkedAt && Date.now() - Date.parse(s.checkedAt) < minMinutes * 60_000) return order;
  const { getOps } = await import("@/lib/ops-store");
  const courier = (await getOps()).couriers.find((c) => c.id === s.courier);
  const api = (courier?.api ?? "") as TrackApi;
  if (!api) return order;
  const { saveOrder, updateOrder } = await import("@/lib/orders");
  try {
    const r = await fetchTracking(api, s.tracking);
    if (!r) return order;
    const next = { ...order, shipment: { ...s, status: r.status, events: r.events.slice(0, 40), checkedAt: new Date().toISOString(), error: undefined } };
    await saveOrder(next);
    if (r.status === "delivered" && order.status === "shipped") return (await updateOrder(order.id, { status: "delivered" }, "courier", `${s.courierName}: delivered`)) ?? next;
    return next;
  } catch (e) {
    const next = { ...order, shipment: { ...s, checkedAt: new Date().toISOString(), error: (e as Error).message.slice(0, 200) } };
    await saveOrder(next).catch(() => {});
    return next;
  }
}
