import { NextResponse } from "next/server";
import { docRoute } from "@/lib/admin-doc";
import { adminGuard } from "@/lib/admin-auth";
import { marketingSchema } from "@/lib/marketing";
import { getMarketing, saveMarketing } from "@/lib/site-store";
export const POST = docRoute(marketingSchema, saveMarketing);
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  return NextResponse.json(await getMarketing());
}
