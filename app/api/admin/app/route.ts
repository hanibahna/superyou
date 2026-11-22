import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { MASK } from "@/lib/marketing";
import { getAppSettings, saveAppSettings, sendPush } from "@/lib/push";

// Save the Firebase key, or send a push: { push: { title, body, url } }.
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const push = z.object({ push: z.object({ title: z.string().min(1).max(65), body: z.string().min(1).max(240), url: z.string().max(300).optional() }) }).safeParse(body);
  if (push.success) {
    try {
      const r = await sendPush(push.data.push);
      return NextResponse.json(r, { status: r.error ? 400 : 200 });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }
  const p = z.object({ serviceAccount: z.string().max(10000) }).safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const s = await getAppSettings();
  if (p.data.serviceAccount !== MASK) {
    if (p.data.serviceAccount) {
      try {
        const j = JSON.parse(p.data.serviceAccount);
        if (!j.project_id || !j.client_email || !j.private_key) throw new Error();
      } catch {
        return NextResponse.json({ error: "That isn't a Firebase service-account key (JSON with project_id, client_email and private_key)" }, { status: 400 });
      }
    }
    s.serviceAccount = p.data.serviceAccount;
  }
  await saveAppSettings(s);
  return NextResponse.json({ ok: true });
}
