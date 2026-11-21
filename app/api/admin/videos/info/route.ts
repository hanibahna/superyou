import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { parseVideo } from "@/lib/site";

// Title + thumbnail for a pasted video link, from the platform's public oEmbed endpoint.
export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const url = req.nextUrl.searchParams.get("url") ?? "";
  const v = parseVideo(url);
  if (!v) return NextResponse.json({ error: "Not a video link" }, { status: 400 });
  const endpoints: Record<string, string> = {
    youtube: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    tiktok: `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
    vimeo: `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
  };
  const ep = endpoints[v.kind];
  if (!ep) return NextResponse.json({ platform: v.kind, title: "", thumbnail: "" });
  try {
    const r = await fetch(ep, { signal: AbortSignal.timeout(8000) });
    const d = r.ok ? await r.json() : {};
    return NextResponse.json({ platform: v.kind, title: d.title ?? "", thumbnail: d.thumbnail_url ?? "", author: d.author_name ?? "" });
  } catch {
    return NextResponse.json({ platform: v.kind, title: "", thumbnail: "" });
  }
}
