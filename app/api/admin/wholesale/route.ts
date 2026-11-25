import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { setWholesaleStatus } from "@/lib/wholesale";

export async function POST(req: NextRequest) {
  const denied = await adminGuard("orders");
  if (denied) return denied;
  const { id, status } = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!id || !["new", "contacted", "approved", "declined"].includes(status ?? "")) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await setWholesaleStatus(id, status as "new");
  return NextResponse.json({ ok: true });
}
