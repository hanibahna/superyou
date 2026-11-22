import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

/** Simple per-visitor hourly limit for public forms (spam, bots). Fails open if the database hiccups. */
export async function limited(req: NextRequest, bucket: string, perHour: number): Promise<NextResponse | null> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `rl:${bucket}:${ip}:${Math.floor(Date.now() / 3_600_000)}`;
  try {
    const n = await db.cmd<number>(["INCR", key]);
    if (n === 1) await db.cmd(["EXPIRE", key, "3700"]);
    if (n > perHour) return NextResponse.json({ error: "Too many attempts. Please try again later or message us on WhatsApp." }, { status: 429 });
  } catch {
    /* allow */
  }
  return null;
}
