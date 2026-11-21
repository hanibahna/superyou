import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard, currentAdmin } from "@/lib/admin-auth";
import { creditGiftCard, getGiftCard, issueGiftCard, setGiftCardDisabled } from "@/lib/giftcards";
import { getOps } from "@/lib/ops-store";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("issue"), amount: z.number().positive().max(10000), recipient: z.string().max(80).optional(), phone: z.string().max(20).optional(), note: z.string().max(200).optional(), count: z.number().int().min(1).max(100).optional() }),
  z.object({ action: z.literal("adjust"), code: z.string().max(30), amount: z.number().min(-10000).max(10000), note: z.string().max(200) }),
  z.object({ action: z.literal("disable"), code: z.string().max(30), disabled: z.boolean() }),
]);

export async function POST(req: NextRequest) {
  const denied = await adminGuard("orders");
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the amount" }, { status: 400 });
  const d = parsed.data;
  const me = (await currentAdmin())!;
  if (d.action === "issue") {
    const ops = await getOps();
    const cards = [];
    for (let i = 0; i < (d.count ?? 1); i++) cards.push(await issueGiftCard({ ...d, validMonths: ops.giftCards.validMonths, by: me.name }));
    return NextResponse.json({ ok: true, codes: cards.map((c) => c.code) });
  }
  const gc = await getGiftCard(d.code);
  if (!gc) return NextResponse.json({ error: "Gift card not found" }, { status: 404 });
  if (d.action === "disable") await setGiftCardDisabled(d.code, d.disabled);
  else {
    if (gc.balance + d.amount < 0) return NextResponse.json({ error: `The balance is only $${gc.balance.toFixed(2)}` }, { status: 400 });
    await creditGiftCard(d.code, d.amount, d.note || (d.amount > 0 ? "Top-up" : "Used in store"));
  }
  return NextResponse.json({ ok: true });
}
