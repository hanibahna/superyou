import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { handleInbound, handleStatus } from "@/lib/whatsapp";

// Meta / 360dialog / WATI webhook: delivery receipts, replies and STOP opt-outs.
// Meta verification: set the verify token to WHATSAPP_VERIFY_TOKEN.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("hub.mode") === "subscribe" && sp.get("hub.verify_token") && sp.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN)
    return new NextResponse(sp.get("hub.challenge") ?? "", { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  // Meta signs webhooks with the app secret; check it when configured.
  const secret = process.env.WHATSAPP_APP_SECRET;
  const sig = req.headers.get("x-hub-signature-256");
  if (secret && sig) {
    const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return new NextResponse("Bad signature", { status: 401 });
  }
  // Optional shared secret in the URL (?key=...) for 360dialog / WATI.
  const key = process.env.WHATSAPP_WEBHOOK_KEY;
  if (key && !sig && req.nextUrl.searchParams.get("key") !== key) return new NextResponse("Forbidden", { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }
  try {
    // Cloud API format (Meta and 360dialog).
    const entries = (body.entry as { changes?: { value?: Record<string, unknown> }[] }[] | undefined) ?? [];
    for (const e of entries)
      for (const ch of e.changes ?? []) {
        const v = ch.value ?? {};
        const names = new Map(((v.contacts as { wa_id: string; profile?: { name?: string } }[]) ?? []).map((c) => [c.wa_id, c.profile?.name]));
        for (const m of (v.messages as { from: string; type: string; text?: { body: string }; button?: { text: string }; interactive?: { button_reply?: { title: string } } }[]) ?? [])
          await handleInbound(m.from, m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? `[${m.type}]`, names.get(m.from));
        for (const s of (v.statuses as { id: string; status: string; errors?: { title?: string; message?: string }[] }[]) ?? [])
          await handleStatus(s.id, s.status, s.errors?.[0]?.message ?? s.errors?.[0]?.title);
      }
    // WATI format.
    const ev = String(body.eventType ?? "");
    if (ev === "message" && body.waId) await handleInbound(String(body.waId), String(body.text ?? ""), String(body.senderName ?? ""));
    if (ev.startsWith("sentMessage") && (body.whatsappMessageId || body.id)) {
      const st = ev.replace("sentMessage", "").replace(/_v2$/, "").toLowerCase();
      await handleStatus(String(body.whatsappMessageId ?? body.id), st === "" ? "sent" : st);
    }
  } catch (e) {
    console.error("[whatsapp webhook]", e);
  }
  return NextResponse.json({ ok: true });
}
