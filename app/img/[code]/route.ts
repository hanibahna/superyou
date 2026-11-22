import { type NextRequest } from "next/server";
import { imgSource } from "@/lib/img-server";

// Product photos served from SuperYou's own address. Cached by the CDN for a year.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const src = imgSource((await params).code);
  if (!src) return new Response("Not found", { status: 404 });
  const w = Math.min(2000, Math.max(40, Number(req.nextUrl.searchParams.get("w")) || 800));
  const up = await fetch(`${src}?width=${w}`, { cache: "force-cache" }).catch(() => null);
  if (!up?.ok || !up.body) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  return new Response(up.body, {
    headers: {
      "Content-Type": up.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
