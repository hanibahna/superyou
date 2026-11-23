import { llmsText } from "@/lib/llms";

export const revalidate = 3600;

// Plain-text guide to the shop for AI assistants (llmstxt.org).
export async function GET() {
  return new Response(await llmsText(false), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
