import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { db } from "@/lib/db";

// Newsletter subscribers as CSV.
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  const list = (await db.cmd<string[]>(["ZREVRANGE", "subscribers", 0, -1])) ?? [];
  return new NextResponse("﻿email\n" + list.join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="subscribers.csv"' },
  });
}
