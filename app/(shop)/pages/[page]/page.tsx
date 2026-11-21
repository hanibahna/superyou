import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { asSuperYou } from "@/lib/catalog";
import { cleanPageText, foreignPage, intro, pageProducts } from "@/lib/info-pages";
import { foreignText, policyText } from "@/lib/policies";
import { getLang } from "@/lib/i18n-server";
import { canonical } from "@/lib/seo";
import { getSettings } from "@/lib/site-store";
import { translateDeep } from "@/lib/translate";

// Info pages (edited in Admin → Settings → Pages) and brand/range pages, which show live products.
const niceTitle = (title: string, brand?: string) => {
  const t = title.replace(/\s*\|.*$/, "").trim();
  return !t || /^(shop by range|our categories|monthly activations|sale off)$/i.test(t) || (brand && t.length > 60) ? brand ?? t : t;
};

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }) {
  const slug = (await params).page;
  const p = (await getSettings()).pages[slug];
  if (!p || foreignPage(slug)) return {};
  const builtIn = policyText(slug, await getSettings());
  if (builtIn) return { title: builtIn.title, ...(await canonical(`/pages/${slug}/`)) };
  const prods = await pageProducts(slug, p.title);
  const title = niceTitle(p.title, prods?.brand);
  return { title: prods?.brand && title !== prods.brand ? `${title} – ${prods.brand}` : title, ...(await canonical(`/pages/${slug}/`)) };
}

export default async function InfoPage({ params }: { params: Promise<{ page: string }> }) {
  const slug = (await params).page;
  const s = await getSettings();
  const stored = s.pages[slug];
  if (!stored || foreignPage(slug)) notFound();
  // Policy pages copied from a supplier are replaced by SuperYou's own until you write yours.
  const builtIn = policyText(slug, s);
  const p0 = builtIn && foreignText.test(stored.body) ? builtIn : stored;
  const lang = await getLang();
  const own = !!builtIn || ["delivery", "payment", "rewards", "about", "privacy", "contact"].includes(slug);
  const prods = own ? null : await pageProducts(slug, p0.title);
  // Only SuperYou speaks: supplier names become SuperYou, their phone numbers and stores are dropped.
  const text = cleanPageText(asSuperYou(p0.body)).split("\n").filter((l) => !/950\s*333|5\s*950|hazmieh|dbayeh|@skinsociety/i.test(l)).join("\n");
  const p = await translateDeep({ title: niceTitle(p0.title, prods?.brand), body: text }, lang, ["title", "body"]);

  // Brand or range page: a short introduction and the products.
  if (prods) {
    const paras = intro(p.body);
    return (
      <div className="container-x py-10">
        <nav className="text-xs text-muted"><Link href="/" className="hover:underline">Home</Link> / {prods.brand ? <Link href={`/shop/?brand=${encodeURIComponent(prods.brand)}`} className="hover:underline">{prods.brand}</Link> : "Pages"}</nav>
        <header className="mt-3 max-w-3xl">
          {prods.brand && p.title !== prods.brand && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{prods.brand}</p>}
          <h1 className="text-3xl font-semibold md:text-4xl">{p.title}</h1>
          {paras.map((t, i) => <p key={i} className="mt-3 text-muted">{t}</p>)}
        </header>
        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-muted">{prods.total} product{prods.total === 1 ? "" : "s"}</p>
          {prods.total > prods.cards.length && <Link href={prods.viewAll} className="text-sm font-semibold text-brand-700 underline">View all {prods.total}</Link>}
        </div>
        <div className="pgrid mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{prods.cards.map((c) => <ProductCard key={c.slug} product={c} />)}</div>
        {prods.total > prods.cards.length && (
          <div className="mt-8 text-center"><Link href={prods.viewAll} className="inline-block rounded-full bg-ink px-8 py-3 text-sm font-semibold text-white">View all {prods.total} products</Link></div>
        )}
      </div>
    );
  }

  const body = p.body.trim() || (slug === "contact" ? [s.store.phone, s.store.email, s.store.address, s.store.openingHours].filter(Boolean).join("\n") : "");
  // A copied page with only headings or menu words left isn't worth showing.
  if (!body || (!own && !intro(body, 1).length)) notFound();
  return (
    <div className="container-x max-w-2xl py-14">
      <h1 className="text-3xl font-semibold">{p.title}</h1>
      <div className="mt-6 space-y-3 text-muted">
        {blocks(body, p.title).map((b, i) =>
          b.type === "ul" ? (
            <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((t, k) => <li key={k}>{t}</li>)}</ul>
          ) : b.type === "h" ? (
            <h2 key={i} className="pt-3 text-lg font-semibold text-ink">{b.text}</h2>
          ) : (
            <p key={i} className="whitespace-pre-line">{b.text}</p>
          ),
        )}
      </div>
      {slug === "contact" && s.store.whatsapp && (
        <a href={`https://wa.me/${s.store.whatsapp}`} target="_blank" rel="noreferrer" className="mt-6 inline-block rounded-lg bg-[#25D366] px-5 py-3 font-semibold text-white">Chat on WhatsApp</a>
      )}
    </div>
  );
}

type Block = { type: "p" | "h"; text: string } | { type: "ul"; items: string[] };

/** Plain text → paragraphs, short headings and bullet lists. */
function blocks(body: string, title: string): Block[] {
  const lines = body.split("\n").map((l) => l.trim());
  if (lines[0]?.toLowerCase() === title.toLowerCase()) lines.shift();
  const out: Block[] = [];
  for (const l of lines) {
    if (!l) continue;
    const last = out[out.length - 1];
    if (l.startsWith("• ")) {
      if (last?.type === "ul") last.items.push(l.slice(2));
      else out.push({ type: "ul", items: [l.slice(2)] });
    } else if (l.length < 60 && !/[.:,;!?]$/.test(l)) out.push({ type: "h", text: l });
    else out.push({ type: "p", text: l });
  }
  return out;
}
