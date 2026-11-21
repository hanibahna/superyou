import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { deleteReview, listReviews, updateReview } from "@/lib/growth-store";

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  return NextResponse.json({ reviews: await listReviews(1000) });
}

export async function PATCH(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = z.object({ slug: z.string(), id: z.string(), status: z.enum(["pending", "approved", "rejected"]).optional(), reply: z.string().max(1000).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { slug, id, ...patch } = p.data;
  const r = await updateReview(slug, id, patch);
  return r ? NextResponse.json({ ok: true, review: r }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const slug = req.nextUrl.searchParams.get("slug") ?? "", id = req.nextUrl.searchParams.get("id") ?? "";
  await deleteReview(slug, id);
  return NextResponse.json({ ok: true });
}
