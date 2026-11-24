import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { docRoute } from "@/lib/admin-doc";
import { promotionsSchema } from "@/lib/site";
import { getPromotions, savePromotions } from "@/lib/site-store";
export const POST = docRoute(promotionsSchema, savePromotions);
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  return NextResponse.json(await getPromotions());
}
