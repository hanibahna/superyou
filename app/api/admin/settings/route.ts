import { docRoute } from "@/lib/admin-doc";
import { settingsSchema } from "@/lib/site";
import { saveSettings } from "@/lib/site-store";
export const POST = docRoute(settingsSchema, saveSettings);

import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { getSettings } from "@/lib/site-store";
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  return NextResponse.json(await getSettings());
}
