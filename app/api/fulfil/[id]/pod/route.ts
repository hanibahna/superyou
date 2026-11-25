import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { tokenFor } from "@/lib/fulfil";

// A proof-of-delivery photo kept in the database (when Vercel Blob isn't set up). The link carries a key.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (req.nextUrl.searchParams.get("k") !== tokenFor(id, "c").slice(0, 10)) return new NextResponse("Not found", { status: 404 });
  const raw = await db.cmd<string | null>(["GET", `fulfil:pod:${id}`]);
  if (!raw) return new NextResponse("Not found", { status: 404 });
  const i = raw.indexOf(";");
  return new NextResponse(Buffer.from(raw.slice(i + 1), "base64"), { headers: { "Content-Type": raw.slice(0, i), "Cache-Control": "private, max-age=86400" } });
}
