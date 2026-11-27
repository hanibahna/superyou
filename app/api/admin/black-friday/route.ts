import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard, currentAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-session";
import { bannerItems, bannerReport, bfLines, bfState, getBanner, saveBanner, saveBf, searchCandidates } from "@/lib/black-friday";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  if (req.nextUrl.searchParams.has("banner")) return NextResponse.json(await bannerReport());
  const q = req.nextUrl.searchParams.get("search");
  if (q !== null) return NextResponse.json(await searchCandidates(q));
  if (req.nextUrl.searchParams.has("picks")) { const b = await getBanner(); return NextResponse.json({ ...b, items: await bannerItems(b) }); }
  const [state, lines] = await Promise.all([bfState(), bfLines()]);
  return NextResponse.json({ state, lines });
}

const schema = z.object({ startsAt: z.string().max(40), endsAt: z.string().max(40), enabled: z.boolean(), pct: z.record(z.string().max(120), z.number().min(0).max(90)) });

const bannerSchema = z.object({ banner: z.object({ items: z.array(z.object({ slug: z.string().max(300), pct: z.number().min(0).max(90) })).max(24), startsAt: z.string().max(40), endsAt: z.string().max(40), enabled: z.boolean(), headline: z.boolean() }) });

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const b = bannerSchema.safeParse(body);
  if (b.success) {
    const r = await saveBanner(b.data.banner);
    const me = await currentAdmin();
    await audit(me?.name ?? "admin", `Black Friday banner: ${r.items} products, ${r.discounts} discounts`).catch(() => {});
    return NextResponse.json({ ok: true, ...r });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the dates and percentages (0–90%)." }, { status: 400 });
  const n = await saveBf(parsed.data);
  const me = await currentAdmin();
  await audit(me?.name ?? "admin", `Black Friday: ${n} product lines, ${parsed.data.enabled ? "on" : "off"}`).catch(() => {});
  return NextResponse.json({ ok: true, lines: n });
}
