import { CallsCalendar } from "@/components/admin/CallsCalendar";
import { MASK } from "@/lib/marketing";
import { listBookings } from "@/lib/site-store";
import { getVideo } from "@/lib/video";

export default async function CallsPage() {
  const [bookings, v] = await Promise.all([listBookings(2000), getVideo()]);
  const items = bookings
    .filter((b) => b.kind === "service" && b.status !== "cancelled")
    .map((b) => ({ id: b.id, title: b.title, date: b.date, time: b.time, duration: b.duration, name: b.name, phone: b.phone, status: b.status, mode: b.mode ?? "store", hasRoom: !!b.video, notes: b.notes }));
  return <CallsCalendar items={items} video={{ provider: v.provider, dailyKey: v.dailyKey ? MASK : "", wherebyKey: v.wherebyKey ? MASK : "", openBefore: v.openBefore }} />;
}
