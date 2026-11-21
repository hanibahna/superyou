import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { docRoute } from "@/lib/admin-doc";
import { opsSchema } from "@/lib/ops";
import { getOps, saveOps } from "@/lib/ops-store";

export async function GET() {
  return (await adminGuard("settings")) ?? NextResponse.json(await getOps());
}
export const POST = docRoute(opsSchema, saveOps);
