import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { upsertProducts } from "@/lib/catalog-admin";

// Receives already-mapped rows from the importer, in chunks of up to 500.
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { rows } = (await req.json().catch(() => ({}))) as { rows?: unknown[] };
  if (!Array.isArray(rows) || rows.length > 500) return NextResponse.json({ error: "Send 1–500 rows per request" }, { status: 400 });
  const r = await upsertProducts(rows as never[]);
  return NextResponse.json({ created: r.created, updated: r.updated, errors: r.errors });
}
