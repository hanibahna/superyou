import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { register360Webhook } from "@/lib/whatsapp";

// Points the 360dialog number at this shop's webhook in one click.
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const origin = req.headers.get("x-forwarded-host") ? `https://${req.headers.get("x-forwarded-host")}` : req.nextUrl.origin;
  const key = process.env.WHATSAPP_WEBHOOK_KEY ? `?key=${process.env.WHATSAPP_WEBHOOK_KEY}` : "";
  try {
    await register360Webhook(`${origin}/api/webhooks/whatsapp/${key}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
