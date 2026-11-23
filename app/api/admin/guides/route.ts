import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";

export const maxDuration = 300;

// Admin: write AI how-to guides for the next best-sellers that don't have one (n at a time, in parallel).
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const n = Math.min(24, Math.max(1, Number(req.nextUrl.searchParams.get("n") ?? 8)));
  const { prefillGuides } = await import("@/lib/product-guide");
  return NextResponse.json(await prefillGuides(n, 8));
}
