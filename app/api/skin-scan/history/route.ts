import { NextResponse, type NextRequest } from "next/server";
import { orderIdsByPhone } from "@/lib/growth-store";
import { scansByPhone } from "@/lib/scans";

// The customer's saved skin scans, for the account page (same check: phone + one of their order numbers).
export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone") ?? "";
  const order = (req.nextUrl.searchParams.get("order") ?? "").trim().toUpperCase();
  if (!phone || !order || !(await orderIdsByPhone(phone)).includes(order)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const list = await scansByPhone(phone.replace(/[^\d+]/g, ""));
  return NextResponse.json({ scans: list.map((s) => ({ id: s.id, link: `/skin-scan/r/${s.id}/?t=${s.token}`, createdAt: s.createdAt, skinType: s.analysis.skinType, concerns: s.analysis.concerns })) });
}
