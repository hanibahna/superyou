import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { deleteInfluencer, getInfluencer, influencerSchema, saveInfluencer } from "@/lib/influencers";

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { action?: string; code?: string; amount?: number; influencer?: unknown } | null;
  if (body?.action === "delete" && body.code) return (await deleteInfluencer(body.code), NextResponse.json({ ok: true }));
  if (body?.action === "pay" && body.code) {
    const i = await getInfluencer(body.code);
    const amount = z.coerce.number().min(0).max(100000).safeParse(body.amount);
    if (!i || !amount.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
    await saveInfluencer({ ...i, paid: +(i.paid + amount.data).toFixed(2) });
    return NextResponse.json({ ok: true });
  }
  const p = influencerSchema.safeParse(body?.influencer);
  if (!p.success) { const x = p.error.issues[0]; return NextResponse.json({ error: `${x.path.join(" › ")}: ${x.message}` }, { status: 400 }); }
  const old = await getInfluencer(p.data.code);
  // A code can't clash with a voucher or a member referral code.
  if (!old && /^REF-/.test(p.data.code)) return NextResponse.json({ error: "Codes starting with REF- are for member referrals" }, { status: 400 });
  await saveInfluencer({ ...p.data, createdAt: old?.createdAt ?? new Date().toISOString(), paid: old?.paid ?? 0 });
  return NextResponse.json({ ok: true });
}
