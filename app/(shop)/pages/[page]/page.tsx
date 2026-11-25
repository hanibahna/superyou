import { notFound } from "next/navigation";
import { asSuperYou } from "@/lib/catalog";
import { cleanPageText, foreignPage, intro, pageProducts } from "@/lib/info-pages";
import { foreignText, policyText } from "@/lib/policies";
import { getLang } from "@/lib/i18n-server";
import { canonical } from "@/lib/seo";
import { getSettings } from "@/lib/site-store";
import { translateDeep } from "@/lib/translate";
import { queryShop } from "@/lib/listing";
import { parseQuery, videosFor, type SP } from "@/lib/shop-query";
import { sectionFor } from "@/lib/extras";
import { listingTips } from "@/lib/tips";
import { ShopView } from "../../shop/ShopView";

// Info pages (edited in Admin → Settings → Pages) and brand/range pages, which show live products.
const niceTitle = (title: string, brand?: string) => {
  const t = title.replace(/\s*\|.*$/, "").trim();
  if (brand && t.toLowerCase().replace(/[^a-z0-9]/g, "") === brand.toLowerCase().replace(/[^a-z0-9]/g, "")) return brand;
  return !t || /^(shop by range|our categories|monthly activations|sale off)$/i.test(t) || (brand && t.length > 60) ? brand ?? t : t;
};

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }) {
  const slug = (await params).page;
  const sub = (await (await import("@/lib/growth-store")).getGrowth()).subscribe;
  const p = (await getSettings()).pages[slug] ?? (slug === "subscription-terms" ? { title: "Subscribe & save terms", body: "" } : undefined);
  if (!p || foreignPage(slug)) return {};
  const builtIn = policyText(slug, await getSettings(), sub);
  if (builtIn) return { title: builtIn.title, ...(await canonical(`/pages/${slug}/`)) };
  const prods = await pageProducts(slug, p.title);
  const title = niceTitle(p.title, prods?.brand);
  return { title: prods?.brand && title !== prods.brand ? `${title} – ${prods.brand}` : title, ...(await canonical(`/pages/${slug}/`)) };
}

export default async function InfoPage({ params, searchParams }: { params: Promise<{ page: string }>; searchParams: Promise<SP> }) {
  const slug = (await params).page;
  const s = await getSettings();
  const sub = (await (await import("@/lib/growth-store")).getGrowth()).subscribe;
  const builtIn = policyText(slug, s, sub);
  // The Subscribe & save terms always follow the current settings unless written in Admin.
  const stored = s.pages[slug] ?? (slug === "subscription-terms" && builtIn ? { title: builtIn.title, body: "" } : undefined);
  if (!stored || foreignPage(slug)) notFound();
  // Policy pages copied from a supplier are replaced by SuperYou's own until you write yours.
  const p0 = builtIn && (foreignText.test(stored.body) || !stored.body) ? builtIn : stored;
  const lang = await getLang();
  const own = !!builtIn || ["delivery", "payment", "rewards", "about", "privacy", "contact"].includes(slug);
  const prods = own ? null : await pageProducts(slug, p0.title);
  // Only SuperYou speaks: supplier names become SuperYou, their phone numbers and stores are dropped.
  const text = cleanPageText(asSuperYou(p0.body)).split("\n").filter((l) => !/950\s*333|5\s*950|hazmieh|dbayeh|@skinsociety/i.test(l)).join("\n");
  const p = await translateDeep({ title: niceTitle(p0.title, prods?.brand), body: text }, lang, ["title", "body"]);

  // Brand or range page: the same listing as every other shop page (filters, sort, header),
  // pre-filtered to the brand / range, with the page's short introduction on top.
  if (prods) {
    const sp = await searchParams;
    const query = { ...parseQuery(sp), ...(prods.brand ? { brand: [prods.brand] } : {}), ...(prods.query && !sp.q ? { q: prods.query } : {}) };
    const [raw, videos] = await Promise.all([queryShop(query), videosFor(query)]);
    const result = { ...raw, facets: await translateDeep(raw.facets, lang, ["name"]) };
    const sec = await sectionFor(query.category);
    const tips = listingTips(result.items, [prods.brand, query.category]);
    return <ShopView result={result} query={query} videos={videos} base={`/pages/${slug}/`} heading={p.title} intro={intro(p.body).slice(0, 2).join("\n\n") || undefined} section={sec ? { ...sec, tips: tips.length ? tips : sec.tips } : null} />;
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
