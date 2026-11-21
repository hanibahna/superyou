import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { saveTaxonomy } from "@/lib/catalog";

const schema = z.object({
  categories: z.array(z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1).max(60),
    image: z.string().max(500).optional(), description: z.string().max(1000).optional(), menu: z.boolean().optional(),
    concernGroup: z.enum(["skin", "hair", "wellness", ""]).optional(),
  })).max(200),
  concerns: z.array(z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1).max(60), group: z.enum(["skin", "hair", "wellness"]), image: z.string().max(500).optional() })).max(300),
});

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Each item needs a name and a slug (lowercase letters, numbers, dashes)." }, { status: 400 });
  const dupe = (xs: { slug: string }[]) => xs.find((x, i) => xs.findIndex((y) => y.slug === x.slug) !== i);
  const d = dupe(parsed.data.categories) ?? dupe(parsed.data.concerns);
  if (d) return NextResponse.json({ error: `Duplicate slug: ${d.slug}` }, { status: 400 });
  await saveTaxonomy(parsed.data);
  return NextResponse.json({ ok: true });
}
