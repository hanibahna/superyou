import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { MASK } from "@/lib/marketing";
import { getTrackKeys, saveTrackKeys, TRACK_SECRETS as SECRET, type TrackKeys } from "@/lib/tracking";

const s = z.string().trim().max(300);
const schema = z.object({
  aramex: z.object({ username: s, password: s, accountNumber: s, accountPin: s, accountEntity: s, accountCountryCode: s }),
  dhl: z.object({ apiKey: s }),
  track17: z.object({ apiKey: s }),
});

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  const old = await getTrackKeys();
  const next = parsed.data as TrackKeys;
  for (const [g, k] of SECRET) if ((next[g] as Record<string, string>)[k] === MASK) (next[g] as Record<string, string>)[k] = (old[g] as Record<string, string>)[k];
  await saveTrackKeys(next);
  return NextResponse.json({ ok: true });
}
