import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { getCampaigns, saveCampaigns } from "@/lib/whatsapp";

const schema = z.array(z.object({
  id: z.string().max(40), name: z.string().min(1).max(100), segmentId: z.string().max(40), template: z.string().max(512), language: z.string().max(10),
  params: z.array(z.string().max(500)).max(10), headerImage: z.string().max(500), status: z.enum(["draft", "sending", "sent"]), createdAt: z.string(), sentAt: z.string().optional(),
  stats: z.object({ targeted: z.number(), sent: z.number(), failed: z.number(), delivered: z.number(), read: z.number(), replied: z.number() }), cursor: z.number(),
})).max(500);

// Save drafts (stats of sent campaigns are kept from the server copy).
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Invalid campaigns" }, { status: 400 });
  const server = new Map((await getCampaigns()).map((c) => [c.id, c]));
  await saveCampaigns(p.data.map((c) => (server.get(c.id) && server.get(c.id)!.status !== "draft" ? server.get(c.id)! : c)));
  return NextResponse.json({ ok: true });
}
