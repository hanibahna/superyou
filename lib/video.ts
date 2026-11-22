import "server-only";

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { Booking } from "@/lib/services";

// Video calls inside the site (Admin → Calls & appointments). The provider hosts the call; we embed
// its room in our own page, so customers never leave shopsuperyou.com. Keys stay on the server.
export type VideoProvider = "" | "daily" | "whereby";
export type VideoConfig = { provider: VideoProvider; dailyKey: string; wherebyKey: string; openBefore: number };
const KEY = "video:config";
export const defaultVideo: VideoConfig = { provider: "", dailyKey: "", wherebyKey: "", openBefore: 10 };

export async function getVideo(): Promise<VideoConfig> {
  try {
    const raw = await db.cmd<string | null>(["GET", KEY]);
    return { ...defaultVideo, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return defaultVideo;
  }
}
export async function saveVideo(v: VideoConfig) {
  await db.cmd(["SET", KEY, JSON.stringify(v)]);
}

export const newAccess = () => randomBytes(12).toString("hex");

/** Beirut wall-clock time of a booking → epoch seconds. */
export function startsAt(b: Pick<Booking, "date" | "time">) {
  return Math.floor(new Date(`${b.date}T${b.time}:00+02:00`).getTime() / 1000);
}

/** Creates the room for a video booking (open from a few minutes before until an hour after). */
export async function createRoom(b: Booking): Promise<Booking["video"] | null> {
  const v = await getVideo();
  const start = startsAt(b);
  const end = start + (b.duration || 30) * 60 + 3600;
  if (v.provider === "daily" && v.dailyKey) {
    const r = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST", headers: { Authorization: `Bearer ${v.dailyKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ privacy: "public", properties: { nbf: start - v.openBefore * 60, exp: end, enable_prejoin_ui: true, enable_chat: true, enable_screenshare: true, eject_at_room_exp: true, lang: "en" } }),
    });
    const j = (await r.json()) as { url?: string; error?: string; info?: string };
    if (!j.url) throw new Error(j.info ?? j.error ?? `Daily ${r.status}`);
    return { provider: "daily", roomUrl: j.url, hostUrl: j.url, createdAt: new Date().toISOString() };
  }
  if (v.provider === "whereby" && v.wherebyKey) {
    const r = await fetch("https://api.whereby.dev/v1/meetings", {
      method: "POST", headers: { Authorization: `Bearer ${v.wherebyKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ endDate: new Date(end * 1000).toISOString(), roomMode: "normal", roomNamePrefix: "superyou", fields: ["hostRoomUrl"] }),
    });
    const j = (await r.json()) as { roomUrl?: string; hostRoomUrl?: string; error?: string };
    if (!j.roomUrl) throw new Error(j.error ?? `Whereby ${r.status}`);
    return { provider: "whereby", roomUrl: j.roomUrl, hostUrl: j.hostRoomUrl || j.roomUrl, createdAt: new Date().toISOString() };
  }
  return null;
}

/** Calendar file (.ics) so the customer and team can add the call to their calendars. */
export function ics(b: Booking, link: string) {
  const s = startsAt(b);
  const f = (t: number) => new Date(t * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (t: string) => t.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SuperYou//Calls//EN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${b.id}@shopsuperyou.com`, `DTSTAMP:${f(Math.floor(Date.now() / 1000))}`,
    `DTSTART:${f(s)}`, `DTEND:${f(s + (b.duration || 30) * 60)}`,
    `SUMMARY:${esc(`SuperYou: ${b.title}`)}`,
    `DESCRIPTION:${esc(b.mode === "video" ? `Join the video call here (opens in your browser, nothing to install): ${link}` : "At the SuperYou store")}`,
    ...(b.mode === "video" ? [`URL:${link}`, "LOCATION:Video call on shopsuperyou.com"] : []),
    "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
