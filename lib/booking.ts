import "server-only";

import { overlaps, slotsFor } from "@/lib/services";
import { getServices, listBookings } from "@/lib/site-store";

/** Free start times for a service on a date (respects staff count, lead time and booking window). */
export async function freeSlots(serviceId: string, date: string) {
  const [cfg, bookings] = await Promise.all([getServices(), listBookings()]);
  const s = cfg.services.find((x) => x.id === serviceId)!;
  const taken = bookings.filter((b) => b.kind === "service" && b.date === date && b.status !== "cancelled");
  const earliest = Date.now() + cfg.leadHours * 3600_000;
  const lastDay = Date.now() + cfg.daysAhead * 86400_000;
  return slotsFor(cfg, s, date).filter((t) => {
    const at = new Date(`${date}T${t}:00+02:00`).getTime(); // store time (Lebanon)
    if (at < earliest || at > lastDay) return false;
    return taken.filter((b) => overlaps(b.time, b.duration, t, s.duration)).length < cfg.staff;
  });
}
