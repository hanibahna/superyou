import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { inSegment, segmentSchema } from "@/lib/wa";
import { allContacts, saveSegments } from "@/lib/whatsapp";

// Save all lists.
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = z.array(segmentSchema).max(100).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid lists" }, { status: 400 });
  await saveSegments(p.data);
  return NextResponse.json({ ok: true });
}

// Live count for a list's rules (opted-in contacts only).
export async function PUT(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = segmentSchema.shape.rules.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid rules" }, { status: 400 });
  const all = (await allContacts()).filter((c) => c.offers);
  const hit = all.filter((c) => inSegment(c, p.data));
  return NextResponse.json({ count: hit.length, sample: hit.slice(0, 5).map((c) => c.name || c.phone) });
}
