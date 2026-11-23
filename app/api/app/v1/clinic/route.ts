import { NextResponse } from "next/server";
import { CLINIC, PROCEDURES, publicProcedure } from "@/lib/clinic";

// Native app: the partner clinic's treatments (mock-up names and prices for now).
export function GET() {
  return NextResponse.json({ partner: CLINIC.partner, mock: CLINIC.mock, note: CLINIC.note, items: PROCEDURES.map(publicProcedure) }, { headers: { "Cache-Control": "public, s-maxage=300" } });
}
