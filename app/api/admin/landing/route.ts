import { docRoute } from "@/lib/admin-doc";
import { landingSchema, type Landing } from "@/lib/site";
import { saveLanding } from "@/lib/site-store";
export const POST = docRoute(landingSchema, (v) => saveLanding(v as Landing));

import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getLanding } from "@/lib/site-store";
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  return NextResponse.json(await getLanding());
}
