import { BookingsTable } from "@/components/admin/BookingsTable";
import { listBookings } from "@/lib/site-store";

export default async function BookingsPage() {
  return <BookingsTable bookings={await listBookings(2000)} />;
}
