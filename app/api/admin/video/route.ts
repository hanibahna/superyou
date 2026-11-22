import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { MASK } from "@/lib/marketing";
import { getVideo, saveVideo } from "@/lib/video";

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = z.object({ provider: z.enum(["", "daily", "whereby"]), dailyKey: z.string().max(400), wherebyKey: z.string().max(2000), openBefore: z.coerce.number().int().min(0).max(60) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const old = await getVideo();
  await saveVideo({ ...p.data, dailyKey: p.data.dailyKey === MASK ? old.dailyKey : p.data.dailyKey.trim(), wherebyKey: p.data.wherebyKey === MASK ? old.wherebyKey : p.data.wherebyKey.trim() });
  return NextResponse.json({ ok: true });
}
