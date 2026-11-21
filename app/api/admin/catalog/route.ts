import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { deleteAllProducts, iterateDetailed, loadBuiltInCatalog, loadSampleProducts, loadSiteSeed } from "@/lib/catalog";

// { action: "sample" } loads demo products; { action: "clear", confirm: "DELETE" } removes all products.
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { action, confirm } = (await req.json().catch(() => ({}))) as { action?: string; confirm?: string };
  if (action === "sample") await loadSampleProducts();
  else if (action === "builtin") return NextResponse.json({ ok: true, count: await loadBuiltInCatalog() });
  else if (action === "builtin-site") return NextResponse.json({ ok: true, docs: await loadSiteSeed(true) });
  else if (action === "clear" && confirm === "DELETE") await deleteAllProducts();
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// Full catalog backup as JSON (same format as the built-in catalog file).
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  const all = [];
  for await (const page of iterateDetailed()) all.push(...page);
  return new NextResponse(JSON.stringify(all), {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="superyou-catalog.json"' },
  });
}
