import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db-core";

// Browsers post Content Security Policy reports here. We keep a count per blocked source and
// directive (not the pages or visitors), so the policy can be tightened without breaking the shop.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { "csp-report"?: Record<string, string> } | Record<string, string>[] | null;
  const reports = Array.isArray(body) ? body.map((r) => (r as unknown as { body?: Record<string, string> }).body ?? r) : body?.["csp-report"] ? [body["csp-report"]] : [];
  for (const r of reports.slice(0, 5)) {
    const dir = String(r["effective-directive"] ?? r["violated-directive"] ?? r.effectiveDirective ?? "").split(" ")[0].slice(0, 40);
    let src = String(r["blocked-uri"] ?? r.blockedURL ?? "");
    try { src = src.startsWith("http") ? new URL(src).origin : src; } catch { /* keep as is */ }
    if (!dir) continue;
    await db.cmd(["HINCRBY", "csp:reports", `${dir} ${src.slice(0, 120)}`, 1]).catch(() => 0);
  }
  return new NextResponse(null, { status: 204 });
}
