import Link from "next/link";
import { liveProducts } from "@/lib/pricing";

export async function generateMetadata() {
  return { title: 'Brands A–Z', description: 'All the skincare, make-up, hair, fragrance and pharmacy brands at SuperYou, from La Roche-Posay to The Ordinary, delivered across Lebanon.', ...(await (await import("@/lib/seo")).canonical('/brands/')) };
}

export default async function BrandsPage() {
  const { list } = await liveProducts();
  const counts = new Map<string, Set<string>>();
  for (const p of list) (counts.get(p.brand) ?? counts.set(p.brand, new Set()).get(p.brand)!).add(p.slug);
  const brands = [...counts.entries()].map(([name, s]) => ({ name, count: s.size })).filter((b) => b.name).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const letter = (n: string) => { const c = n.normalize("NFKD")[0].toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
  const groups = new Map<string, typeof brands>();
  for (const b of brands) (groups.get(letter(b.name)) ?? groups.set(letter(b.name), []).get(letter(b.name))!).push(b);
  const top = [...brands].sort((a, b) => b.count - a.count).slice(0, 12);
  return (
    <div className="container-x py-10">
      <h1 className="text-3xl font-semibold">Brands A–Z</h1>
      <p className="mt-1 text-sm text-muted">{brands.length.toLocaleString("en-US")} brands</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {top.map((b) => <Link key={b.name} href={`/shop/?brand=${encodeURIComponent(b.name)}`} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">{b.name}</Link>)}
      </div>
      <nav className="sticky top-[7.5rem] z-10 mt-8 flex flex-wrap gap-1 bg-white/95 py-2 text-sm font-semibold backdrop-blur">
        {[...groups.keys()].map((l) => <a key={l} href={`#b-${l}`} className="grid h-8 w-8 place-items-center rounded hover:bg-brand-50">{l}</a>)}
      </nav>
      <div className="mt-4 space-y-8">
        {[...groups.entries()].map(([l, list]) => (
          <section key={l} id={`b-${l}`} className="scroll-mt-40">
            <h2 className="mb-3 border-b border-line pb-1 text-2xl font-bold">{l}</h2>
            <ul className="columns-2 gap-6 text-sm sm:columns-3 lg:columns-5">
              {list.map((b) => <li key={b.name} className="break-inside-avoid py-1"><Link href={`/shop/?brand=${encodeURIComponent(b.name)}`} className="hover:underline">{b.name}</Link> <span className="text-xs text-muted">{b.count}</span></li>)}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
