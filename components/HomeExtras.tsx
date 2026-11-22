// Home page pieces that carry the SuperYou promise: the four promise tiles under the hero,
// a quick-jump row of the main aisles, and the pharmacist band in the middle of the page.
import Link from "next/link";
import { ChatIcon, ShieldIcon, StarIcon, TruckIcon } from "./Icons";
import { waLink } from "@/lib/growth";

export function PromiseStrip({ t, freeOver }: { t: (s: string) => string; freeOver: number }) {
  const items = [
    { icon: <ShieldIcon width={22} height={22} />, title: t("100% original"), text: t("From official Lebanese distributors") },
    { icon: <ChatIcon width={22} height={22} />, title: t("A pharmacist to ask"), text: t("Free advice on WhatsApp") },
    { icon: <TruckIcon width={22} height={22} />, title: t("Pay on delivery"), text: freeOver > 0 ? `${t("Free delivery over")} $${freeOver}` : t("Delivered all over Lebanon") },
    { icon: <StarIcon width={22} height={22} />, title: t("Easy returns"), text: t("Unopened items within 7 days") },
  ];
  return (
    <section aria-label={t("Our promise")} className="border-b border-line bg-white">
      <div className="container-x pt-7 text-center md:pt-9">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600">{t("Reveal the super in you")}</p>
        <p className="mx-auto mt-2 max-w-3xl text-base font-semibold leading-snug md:text-2xl">
          {t("Every product original. Every question answered.")} <span className="text-brand-600">{t("Every order at your door, paid when it arrives.")}</span>
        </p>
      </div>
      <ul className="container-x grid grid-cols-2 gap-x-4 gap-y-5 py-6 md:grid-cols-4 md:py-7">
        {items.map((i) => (
          <li key={i.title} className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">{i.icon}</span>
            <span className="min-w-0">
              <b className="block text-sm font-semibold leading-tight md:text-base">{i.title}</b>
              <span className="mt-0.5 block text-xs leading-snug text-muted md:text-sm">{i.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One-tap jumps to the main aisles, so nobody has to scroll to find their way. */
export function QuickJump({ t, links }: { t: (s: string) => string; links: { label: string; href: string; hot?: boolean }[] }) {
  if (!links.length) return null;
  return (
    // Sticks under the header on phones, so the aisles stay one tap away while scrolling.
    <nav aria-label={t("Shop quickly")} className="sticky top-[var(--hdr-h,116px)] z-30 border-b border-line bg-white/95 py-2 backdrop-blur md:static md:border-0 md:bg-transparent md:pt-6 md:backdrop-blur-none">
      <div className="container-x">
      <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {links.map((l) => (
          <li key={l.href} className="shrink-0">
            <Link href={l.href} className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold transition ${l.hot ? "border-ink bg-ink text-white hover:bg-black" : "border-line bg-white hover:border-ink"}`}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
      </div>
    </nav>
  );
}

/** Mid-page invitation to talk to a pharmacist or let the skin scan pick a routine. */
export function PharmacistBand({ t, whatsapp, scan }: { t: (s: string) => string; whatsapp: string; scan: boolean }) {
  return (
    <section className="container-x py-10">
      <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-10 text-white md:px-12 md:py-14">
        <div aria-hidden className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="relative grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-100">{t("Pharmacist-picked")}</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">{t("Not sure what your skin needs?")}</h2>
            <p className="mt-3 max-w-xl text-white/80">{t("Ask our pharmacists on WhatsApp. They answer for free and build a routine around your skin, your budget and what you already use.")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            {whatsapp && (
              <a href={waLink(whatsapp, "Hello, I'd like advice from a pharmacist")} target="_blank" rel="noreferrer" className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 font-semibold text-white hover:brightness-95">
                <ChatIcon width={20} height={20} /> {t("Ask a pharmacist")}
              </a>
            )}
            <Link href={scan ? "/skin-scan/" : "/routine/"} className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/40 px-6 font-semibold hover:bg-white/10">
              {scan ? t("Try the AI skin scan") : t("Find my routine")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Home: the AI skin scan, right under the first banner. */
export function ScanBanner({ t }: { t: (s: string) => string }) {
  return (
    <section className="container-x py-4">
      <Link href="/skin-scan/" className="scan-glow group flex flex-wrap items-center gap-4 overflow-hidden rounded-3xl p-5 text-white md:flex-nowrap md:gap-6 md:p-7">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/20 md:h-20 md:w-20">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2" /><path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 005 0" /></svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">{t("New · free")}</span>
          <span className="mt-1 block text-xl font-bold leading-tight md:text-2xl">{t("AI 3D skin scan: turn your head, get your routine")}</span>
          <span className="mt-1 block text-sm text-white/85">{t("Reads your skin type, shine, redness and spots in seconds, then picks products in stock. Photos aren't stored.")}</span>
        </span>
        <span className="inline-flex min-h-[48px] shrink-0 items-center rounded-full bg-white px-6 font-semibold text-ink transition group-hover:scale-105">{t("Scan my skin")} →</span>
      </Link>
    </section>
  );
}
