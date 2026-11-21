import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { saveTheme } from "@/lib/theme-store";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour like #c0587a");
const schema = z.object({ primary: hex, ink: hex, sale: hex, background: hex });

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid colours" }, { status: 400 });
  const t = Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, v.toLowerCase()])) as z.infer<typeof schema>;
  await saveTheme(t);
  return NextResponse.json({ ok: true, theme: t });
}
