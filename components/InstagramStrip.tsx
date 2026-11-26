// "Follow us on Instagram" band: the latest launch posts (static copies in /public/ig) linking to the profile.
// Hidden when no Instagram link is set in Admin › Settings › Social.
export function InstagramStrip({ url, posts = 6 }: { url: string; posts?: number }) {
  if (!url) return null;
  const handle = url.replace(/\/+$/, "").split("/").pop() ?? "";
  return (
    <section className="container-x py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600">Instagram</p>
          <h2 className="mt-1 text-2xl font-black md:text-3xl">Follow @{handle}</h2>
          <p className="mt-1 text-sm text-muted">Tonight&apos;s prices, pharmacist routines and new arrivals.</p>
        </div>
        <a href={url} target="_blank" rel="noreferrer" className="tap rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white">Follow on Instagram</a>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
        {Array.from({ length: posts }, (_, i) => (
          <a key={i} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-[#f6f1f3]" aria-label={`SuperYou on Instagram, post ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/ig/post-${i + 1}.jpg`} alt="" loading="lazy" width={540} height={675} className="aspect-[4/5] w-full object-cover transition-transform hover:scale-[1.03]" />
          </a>
        ))}
      </div>
    </section>
  );
}
