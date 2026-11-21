import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { addPoints, getMember, joinClub } from "@/lib/growth-store";

// Add or remove points by hand (goodwill, corrections, in-store purchases).
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = z.object({ phone: z.string().min(6).max(30), points: z.number().int().min(-100000).max(100000), reason: z.string().min(1).max(200), name: z.string().max(80).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Phone, points and a reason are needed" }, { status: 400 });
  if (!(await getMember(p.data.phone))) {
    if (!p.data.name) return NextResponse.json({ error: "Not a member yet — add their name to create the membership" }, { status: 404 });
    await joinClub({ phone: p.data.phone, name: p.data.name });
  }
  const m = await addPoints(p.data.phone, p.data.points, `${p.data.reason} (by the shop)`);
  return NextResponse.json({ ok: true, points: m?.points ?? 0 });
}
