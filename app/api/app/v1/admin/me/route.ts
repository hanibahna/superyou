import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin-auth";

// Native app: is this phone signed in to the Owner tab?
export async function GET() {
  const me = await currentAdmin();
  return NextResponse.json(me ? { signedIn: true, name: me.name, role: me.role } : { signedIn: false }, { headers: { "Cache-Control": "no-store" } });
}
