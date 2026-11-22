import "server-only";

// Admin-editable documents (settings, homepage, promotions, search, videos, routine, layout),
// each stored as one JSON value. Cached per server instance for a few seconds.

import { ensureSeeded } from "@/lib/catalog";
import { db } from "@/lib/db";
import {
  defaultCollections, type Collections,
  defaultLanding, defaultPromotions, defaultSearchSettings, defaultVideoLibrary, withDefaults,
  type Landing, type Promotions, type SearchSettings, type Settings, type VideoLibrary,
} from "@/lib/site";
import { defaultLayout, type LayoutOptions } from "@/lib/layouts";
import { withSourcingDefaults, type Sourcing } from "@/lib/sourcing";
import { defaultRoutine, type RoutineConfig } from "@/lib/routine";
import { defaultServices, type Booking, type ServicesConfig } from "@/lib/services";

const TTL = 5000;
const g = globalThis as unknown as { __docs?: Map<string, { at: number; value: unknown }> };
const cache = (g.__docs ??= new Map());

async function read<T>(key: string, fallback: T, fix: (v: T) => T = (v) => v): Promise<T> {
  await ensureSeeded();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  let value = fallback;
  try {
    const raw = await db.cmd<string | null>(["GET", key]);
    if (raw) value = fix(JSON.parse(raw) as T);
  } catch {
    // never let a database hiccup break the shop
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function write<T>(key: string, value: T) {
  await db.cmd(["SET", key, JSON.stringify(value)]);
  cache.set(key, { at: Date.now(), value });
}

export const getSettings = () => read<Settings>("settings", withDefaults(null), (v) => withDefaults(v));
export const saveSettings = (v: Settings) => write("settings", v);

export const getLanding = () => read<Landing>("landing", defaultLanding);
export const saveLanding = (v: Landing) => write("landing", v);

export const getPromotions = () => read<Promotions>("promotions", defaultPromotions, (v) => ({ ...defaultPromotions, ...v }));
export const savePromotions = (v: Promotions) => write("promotions", v);

export const getSearchSettings = () =>
  read<SearchSettings>("search", defaultSearchSettings, (v) => ({
    ...defaultSearchSettings, ...v,
    fields: { ...defaultSearchSettings.fields, ...v.fields },
    filters: { ...defaultSearchSettings.filters, ...v.filters },
  }));
export const saveSearchSettings = (v: SearchSettings) => write("search", v);

export const getVideoLibrary = () => read<VideoLibrary>("videos", defaultVideoLibrary, (v) => ({ ...defaultVideoLibrary, ...v, show: { ...defaultVideoLibrary.show, ...v.show } }));
export const saveVideoLibrary = (v: VideoLibrary) => write("videos", v);

export const getRoutine = () => read<RoutineConfig>("routine", defaultRoutine, (v) => ({ ...defaultRoutine, ...v }));
export const saveRoutine = (v: RoutineConfig) => write("routine", v);

export const getCollections = () => read<Collections>("collections", defaultCollections);
export const saveCollections = (v: Collections) => write("collections", v);

export const getLayout = () => read<LayoutOptions>("layout", defaultLayout, (v) => ({ ...defaultLayout, ...v }));
export const saveLayout = (v: LayoutOptions) => write("layout", v);

/** Count one coupon use (best effort, at order time). */
export async function countCouponUse(code: string) {
  const p = await getPromotions();
  const d = p.discounts.find((x) => x.code && x.code.toLowerCase() === code.toLowerCase());
  if (!d) return;
  d.used += 1;
  await savePromotions(p);
}

export const getServices = () => read<ServicesConfig>("services", defaultServices, (v) => ({ ...defaultServices, ...v }));
export const saveServices = (v: ServicesConfig) => write("services", v);

// Bookings and event sign-ups: one JSON value each, indexed by a sorted set.
export async function saveBooking(b: Booking) {
  await db.pipeline([["SET", `booking:${b.id}`, JSON.stringify(b)], ["ZADD", "bookings", Date.parse(`${b.date}T${b.time}:00`) || Date.now(), b.id]]);
}
export async function getBooking(id: string): Promise<Booking | null> {
  const raw = await db.cmd<string | null>(["GET", `booking:${id}`]);
  return raw ? (JSON.parse(raw) as Booking) : null;
}
export async function listBookings(limit = 1000): Promise<Booking[]> {
  const ids = (await db.cmd<string[]>(["ZREVRANGE", "bookings", 0, limit - 1])) ?? [];
  if (!ids.length) return [];
  const rows = await db.pipeline(ids.map((id) => ["GET", `booking:${id}`]));
  return rows.map((r) => (r ? (JSON.parse(String(r)) as Booking) : null)).filter((b): b is Booking => !!b);
}

// Catalog visibility: hide whole sources (imported catalogs) or brands from the shop.
export type Visibility = { hiddenSources: string[]; hiddenBrands: string[] };
export const getVisibility = () => read<Visibility>("visibility", { hiddenSources: [], hiddenBrands: [] }, (v) => ({ hiddenSources: v.hiddenSources ?? [], hiddenBrands: v.hiddenBrands ?? [] }));
export const saveVisibility = (v: Visibility) => write("visibility", v);

/** For other server modules that keep their own admin document (e.g. lib/growth-store.ts). */
export const readDoc = read;
export const writeDoc = write;

/** Local vs international catalogs: delivery times and import pricing (Admin → Sourcing). */
export const getSourcing = () => read<Sourcing>("sourcing", withSourcingDefaults(null), (v) => withSourcingDefaults(v));
export const saveSourcing = (v: Sourcing) => write("sourcing", withSourcingDefaults(v));
