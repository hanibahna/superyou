import { NextResponse, type NextRequest } from "next/server";
import { adminGuard, currentAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-session";
import { check2fa, confirm2fa, disable2fa, has2fa, start2fa } from "@/lib/admin-security";

// The signed-in person's own authenticator setup (owner and staff alike).
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  const me = (await currentAdmin())!;
  return NextResponse.json({ enabled: await has2fa(me.id) });
}

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const me = (await currentAdmin())!;
  const { action, code } = (await req.json().catch(() => ({}))) as { action?: string; code?: string };
  if (action === "start") {
    if (await has2fa(me.id)) return NextResponse.json({ error: "Already on. Turn it off first to move it to a new phone." }, { status: 409 });
    const { secret, svg } = await start2fa(me.id, me.id === "owner" ? "owner" : me.id);
    return NextResponse.json({ secret, svg });
  }
  if (action === "confirm") {
    if (!code || !(await confirm2fa(me.id, code))) return NextResponse.json({ error: "That code didn't match. Check the phone's time is set automatically, then try the newest code." }, { status: 400 });
    await audit(me.name, "turned on authenticator codes").catch(() => {});
    return NextResponse.json({ enabled: true });
  }
  if (action === "disable") {
    if (!code || !(await check2fa(me.id, code))) return NextResponse.json({ error: "Enter a current code from your authenticator app to turn this off." }, { status: 400 });
    await disable2fa(me.id);
    await audit(me.name, "turned off authenticator codes").catch(() => {});
    return NextResponse.json({ enabled: false });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
