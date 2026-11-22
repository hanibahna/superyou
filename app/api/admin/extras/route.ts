import { adminGuard } from "@/lib/admin-auth";
import { NextResponse, type NextRequest } from "next/server";
import { extrasSchema, getExtras, saveExtras } from "@/lib/extras";
import { MASK } from "@/lib/marketing";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = extrasSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) { const i = p.error.issues[0]; return NextResponse.json({ error: `${i.path.join(" › ")}: ${i.message}` }, { status: 400 }); }
  const old = await getExtras();
  const key = p.data.youtube.key === MASK ? old.youtube.key : p.data.youtube.key.trim();
  // Pins changed → drop those products' cached searches so the page shows the change at once.
  const changed = Object.keys({ ...old.youtube.pins, ...p.data.youtube.pins }).filter((s) => old.youtube.pins[s] !== p.data.youtube.pins[s]);
  await Promise.all(changed.map((s) => db.cmd(["DEL", `yt:v1:${s}`]).catch(() => {})));
  await saveExtras({ ...p.data, youtube: { ...p.data.youtube, key } });
  return NextResponse.json({ ok: true });
}
