import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { getAllProducts, getProductsDetailed, getTaxonomy } from "@/lib/catalog";
import { getGrowth } from "@/lib/growth-store";
import { getCollections, getLanding, getRoutine, getServices, getSettings } from "@/lib/site-store";
import { aiReady, countTranslations, listTranslations, saveTranslation, translateMany } from "@/lib/translate";

export const maxDuration = 300;
const langSchema = z.enum(["fr", "ar"]);

export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const lang = langSchema.parse(req.nextUrl.searchParams.get("lang") ?? "fr");
  const [list, fr, ar] = await Promise.all([listTranslations(lang, req.nextUrl.searchParams.get("cursor") ?? "0", 300), countTranslations("fr"), countTranslations("ar")]);
  return NextResponse.json({ ...list, counts: { fr, ar }, aiReady: aiReady() });
}

export async function PATCH(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = z.object({ lang: langSchema, source: z.string().min(1).max(10000), text: z.string().min(1).max(10000) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await saveTranslation(p.data.lang, p.data.source, p.data.text);
  return NextResponse.json({ ok: true });
}

// Pre-translate: part "store" = everything except products; part "products" = product descriptions, page by page.
const pick = (v: unknown, fields: Set<string>, out: string[], k?: string) => {
  if (typeof v === "string") { if (k && fields.has(k) && /[A-Za-z]{2}/.test(v)) out.push(v); return; }
  if (Array.isArray(v)) return v.forEach((x) => pick(x, fields, out, k));
  if (v && typeof v === "object") for (const [kk, vv] of Object.entries(v)) pick(vv, fields, out, kk);
};

export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  if (!aiReady()) return NextResponse.json({ error: "Add ANTHROPIC_API_KEY in Vercel first." }, { status: 400 });
  const p = z.object({ lang: langSchema, part: z.enum(["store", "products"]), offset: z.number().int().min(0).default(0) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { lang, part, offset } = p.data;
  if (part === "store") {
    const [settings, landing, tax, cols, routine, services, growth] = await Promise.all([getSettings(), getLanding(), getTaxonomy(), getCollections(), getRoutine(), getServices(), getGrowth()]);
    const texts: string[] = [];
    pick({ menu: settings.menu, footerMenu: settings.footerMenu, announcement: settings.announcement, trust: settings.trust, store: { tagline: settings.store.tagline }, delivery: { estimate: settings.delivery.estimate } }, new Set(["label", "title", "text", "tagline", "estimate"]), texts);
    pick(Object.values(settings.pages), new Set(["title", "body"]), texts);
    pick(landing.sections, new Set(["eyebrow", "title", "text", "cta", "cta2", "badge", "body"]), texts);
    pick(tax, new Set(["name", "description"]), texts);
    pick(cols.items.filter((c) => !c.hidden), new Set(["title", "description"]), texts);
    pick(routine, new Set(["title", "intro", "label", "hint", "name", "tip"]), texts);
    pick(services, new Set(["name", "description", "intro", "title", "text", "location"]), texts);
    pick(growth, new Set(["title", "text", "tabLabel", "cartExitText", "label", "hours", "perks", "lines", "returnsSummary", "intro"]), texts);
    const uniq = [...new Set(texts)];
    const done = await translateMany(uniq, lang, { wait: true });
    return NextResponse.json({ ok: true, total: uniq.length, translated: done.size });
  }
  // Products: 60 items (one size per product) per call; the admin page keeps calling until done.
  const all = await getAllProducts();
  const bySlug = new Map<string, string>();
  for (const x of all) if (x.status === "active" && !bySlug.has(x.slug)) bySlug.set(x.slug, x.id);
  const ids = [...bySlug.values()];
  const slice = ids.slice(offset, offset + 60);
  const details = await getProductsDetailed(slice);
  await translateMany(details.flatMap((d) => [d.description, d.howToUse]).filter(Boolean), lang, { wait: true });
  return NextResponse.json({ ok: true, total: ids.length, next: offset + slice.length, done: offset + slice.length >= ids.length });
}
