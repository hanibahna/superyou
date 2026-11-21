import { getLang } from "@/lib/i18n-server";
import { translateDeep, translateMany } from "@/lib/translate";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/site-store";

// Info pages — edited in Admin → Settings → Pages.
export async function generateMetadata({ params }: { params: Promise<{ page: string }> }) {
  const p = (await getSettings()).pages[(await params).page];
  return p ? { title: p.title } : {};
}

export default async function InfoPage({ params }: { params: Promise<{ page: string }> }) {
  const slug = (await params).page;
  const s = await getSettings();
  const p0 = s.pages[slug];
  if (!p0) notFound();
  const p = await translateDeep(p0, await getLang(), ["title", "body"]);
  const body = p.body.trim() || (slug === "contact" ? [s.store.phone, s.store.email, s.store.address, s.store.openingHours].filter(Boolean).join("\n") : "");
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
