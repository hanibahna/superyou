import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";

/** POST handler that validates a whole settings document and saves it. */
export function docRoute<S extends z.ZodTypeAny>(schema: S, save: (v: z.infer<S>) => Promise<unknown>) {
  return async function POST(req: NextRequest) {
    const denied = await adminGuard();
    if (denied) return denied;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      return NextResponse.json({ error: `${i.path.join(" › ") || "Input"}: ${i.message}` }, { status: 400 });
    }
    await save(parsed.data);
    return NextResponse.json({ ok: true });
  };
}
