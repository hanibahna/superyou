import { docRoute } from "@/lib/admin-doc";
import { servicesSchema } from "@/lib/services";
import { saveServices } from "@/lib/site-store";
export const POST = docRoute(servicesSchema, saveServices);

import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getServices } from "@/lib/site-store";
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  return NextResponse.json(await getServices());
}
