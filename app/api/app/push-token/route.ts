import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { saveToken } from "@/lib/push";

// The iOS / Android app registers its push token here (see components/AppBridge.tsx).
export async function POST(req: NextRequest) {
  const p = z.object({ token: z.string().min(20).max(400), platform: z.enum(["ios", "android"]) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  await saveToken(p.data.token, p.data.platform);
  return NextResponse.json({ ok: true });
}
