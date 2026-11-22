import Link from "next/link";
import { notFound } from "next/navigation";
import { getBooking } from "@/lib/site-store";

// Join a customer's video call as the host, inside the control panel.
export default async function HostCall({ params }: { params: Promise<{ id: string }> }) {
  const b = await getBooking((await params).id);
  if (!b || b.mode !== "video") notFound();
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{b.title} · {b.name}</h1>
          <p className="text-sm text-muted">{b.date} at {b.time} · {b.duration} min · {b.phone}{b.notes ? ` · “${b.notes}”` : ""}</p>
        </div>
        <Link href="/admin/calls/" className="rounded-lg border border-line px-4 py-2 text-sm font-semibold">Back to calendar</Link>
      </div>
      {b.video ? (
        <iframe src={b.video.hostUrl} title="Video call" allow="camera; microphone; fullscreen; speaker; display-capture; autoplay; clipboard-write" className="h-[78vh] w-full rounded-2xl border border-line bg-black" />
      ) : (
        <p className="rounded-xl bg-amber-50 p-4 text-sm">No room yet. Set up a video provider in Calls & appointments, then confirm the booking to create it.</p>
      )}
    </div>
  );
}
