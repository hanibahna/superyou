import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { smsSchema, type SmsConfig } from "@/lib/sms-config";
import { getSms, saveSms, sendSms } from "@/lib/sms";

// Save settings, or { test: { phone, text } } to send one test SMS with the saved settings.
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const test = z.object({ test: z.object({ phone: z.string().min(6).max(30), text: z.string().min(1).max(320) }) }).safeParse(body);
  if (test.success) {
    const r = await sendSms(test.data.test.phone, test.data.test.text, await getSms());
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  const parsed = smsSchema.safeParse(body);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return NextResponse.json({ error: `${i.path.join(" › ") || "Input"}: ${i.message}` }, { status: 400 });
  }
  await saveSms(parsed.data as SmsConfig);
  return NextResponse.json({ ok: true });
}
