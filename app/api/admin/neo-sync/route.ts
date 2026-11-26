import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";

// Admin: the last NeoVitale catalog sync report (the same text as the email).
export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const sync = await import("@/lib/neo-sync");
  const last = await sync.lastSync();
  const cur = await sync.currentSync();
  // ?send=1 emails the last report again (used to test email delivery).
  if (req.nextUrl.searchParams.has("send") && last) return NextResponse.json({ to: sync.REPORT_TO, sent: await sync.sendReport(last) });
  return new NextResponse(last ? sync.reportText(last) : "No sync has finished yet.", { headers: { "content-type": "text/plain; charset=utf-8", "x-running": cur && !cur.done ? "1" : "0" } });
}
