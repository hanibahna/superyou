import { LifespansAdmin } from "@/components/admin/LifespansAdmin";
import { getLives, lifeStats } from "@/lib/lifespan";
import { liveProducts } from "@/lib/pricing";

type SP = Record<string, string | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").toLowerCase().trim();
  const plan = sp.plan ?? "";
  const live = (await liveProducts()).list;
  const seen = new Set<string>();
  const items = live.filter((p) => (seen.has(p.slug) ? false : (seen.add(p.slug), true)));
  const lives = await getLives(items.map((p) => p.slug));
  const rows = items
    .map((p) => ({ slug: p.slug, name: `${p.brand} ${p.name}`, size: p.size ?? "", category: p.category, life: lives.get(p.slug) ?? null }))
    .filter((r) => (!q || r.name.toLowerCase().includes(q)) && (!plan || (plan === "none" ? !r.life : plan === "no" ? r.life?.every === 0 : String(r.life?.every) === plan)))
    .slice(0, 200);
  return <LifespansAdmin rows={rows} stats={await lifeStats()} totalProducts={items.length} q={sp.q ?? ""} plan={plan} />;
}
