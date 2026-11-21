import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { sendTemplate } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = z.object({ to: z.string(), template: z.string(), language: z.string(), params: z.array(z.string()), headerImage: z.string().optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid test message" }, { status: 400 });
  const r = await sendTemplate({ ...p.data, kind: "test" });
  return NextResponse.json(r);
}
