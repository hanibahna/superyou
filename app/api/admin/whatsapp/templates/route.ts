import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { createTemplate, listTemplates } from "@/lib/whatsapp";

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  return NextResponse.json(await listTemplates());
}

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = z.object({ name: z.string().regex(/^[a-z0-9_]{1,512}$/), category: z.enum(["UTILITY", "MARKETING"]), language: z.string().max(10), body: z.string().min(1).max(1024), example: z.array(z.string()), header: z.literal("IMAGE").optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Template names: lowercase letters, numbers and _ only" }, { status: 400 });
  try {
    await createTemplate(p.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
