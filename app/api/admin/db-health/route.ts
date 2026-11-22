import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { db, dbConfigured } from "@/lib/db";

// Quick database check for the team: is the store reachable, and what does it say if not?
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const pong = await db.cmd<string>(["PING"]);
    const size = await db.cmd<number>(["DBSIZE"]).catch(() => null);
    return NextResponse.json({ ok: true, configured: dbConfigured, pong, keys: size });
  } catch (e) {
    return NextResponse.json({ ok: false, configured: dbConfigured, error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
