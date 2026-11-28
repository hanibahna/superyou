import { NextResponse } from "next/server";
import { emailPricingCheck } from "@/lib/pricing-email";

export const maxDuration = 120;

// Admin only (the proxy checks /api/admin/* for a signed-in staff member with the "settings" area).
export async function POST() {
  return NextResponse.json(await emailPricingCheck());
}
