import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { addStaff, removeStaff, updateStaff } from "@/lib/staff";

const role = z.enum(["manager", "orders", "catalog", "marketing"]);
const pw = z.string().min(10, "Passwords need at least 10 characters").max(100);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), email: z.string().email("Enter a valid email"), name: z.string().min(1).max(60), role, password: pw }),
  z.object({ action: z.literal("update"), email: z.string().email(), name: z.string().min(1).max(60).optional(), role: role.optional(), active: z.boolean().optional(), password: pw.optional() }),
  z.object({ action: z.literal("remove"), email: z.string().email() }),
]);

// Owner only (proxy.ts and the guard below both check).
export async function POST(req: NextRequest) {
  const denied = await adminGuard("staff");
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form" }, { status: 400 });
  const d = parsed.data;
  try {
    if (d.action === "add") await addStaff(d);
    else if (d.action === "update") await updateStaff(d.email, d);
    else await removeStaff(d.email);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
