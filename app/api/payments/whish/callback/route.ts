import { NextResponse, type NextRequest } from "next/server";
import { settleWhish } from "@/lib/payments/whish";

// Whish calls this once when a payment succeeds or fails. It's only a hint: settleWhish asks Whish.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("order") ?? "";
  if (id) await settleWhish(id).catch((e) => console.error("[whish] callback", e));
  return NextResponse.json({ ok: true });
}
export const POST = GET;
