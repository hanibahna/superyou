import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { sendCampaignBatch } from "@/lib/whatsapp";

// Sends the next batch; the admin page calls this until done (no background job needed).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    return NextResponse.json(await sendCampaignBatch((await params).id));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
