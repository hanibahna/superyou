import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard, currentAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-session";
import { bannerReport, bfLines, bfState, saveBf } from "@/lib/black-friday";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  if (req.nextUrl.searchParams.has("banner")) return NextResponse.json(await bannerReport());
  const [state, lines] = await Promise.all([bfState(), bfLines()]);
  return NextResponse.json({ state, lines });
}

const schema = z.object({ startsAt: z.string().max(40), endsAt: z.string().max(40), enabled: z.boolean(), pct: z.record(z.string().max(120), z.number().min(0).max(90)) });

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the dates and percentages (0–90%)." }, { status: 400 });
  const n = await saveBf(parsed.data);
  const me = await currentAdmin();
  await audit(me?.name ?? "admin", `Black Friday: ${n} product lines, ${parsed.data.enabled ? "on" : "off"}`).catch(() => {});
  return NextResponse.json({ ok: true, lines: n });
}
