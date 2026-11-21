import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { docRoute } from "@/lib/admin-doc";
import { growthSchema } from "@/lib/growth";
import { getGrowth, saveGrowth } from "@/lib/growth-store";

export async function GET() {
  return (await adminGuard()) ?? NextResponse.json(await getGrowth());
}
export const POST = docRoute(growthSchema, saveGrowth);
