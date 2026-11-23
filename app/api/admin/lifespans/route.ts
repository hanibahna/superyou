import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { everyForDays } from "@/lib/every";

export const maxDuration = 300;

// Admin: build the "how long it lasts" database with AI (POST ?calls=), or correct one product (PUT).
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const calls = Math.min(40, Math.max(1, Number(req.nextUrl.searchParams.get("calls") ?? 10)));
  const { buildLifespans } = await import("@/lib/lifespan");
  return NextResponse.json(await buildLifespans(calls, 10));
}

export async function PUT(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = z.object({ slug: z.string().max(200), days: z.number().int().min(1).max(3650), sub: z.boolean(), basis: z.string().max(80).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const { setLife } = await import("@/lib/lifespan");
  await setLife(p.data.slug, { days: p.data.days, every: p.data.sub ? everyForDays(p.data.days) : 0, basis: p.data.basis ?? "Set by admin", by: "admin", v: 2 });
  return NextResponse.json({ ok: true, every: p.data.sub ? everyForDays(p.data.days) : 0 });
}
