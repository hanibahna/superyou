"use client";

import Link from "next/link";
import { imgUrl } from "@/lib/img";
import { useT } from "@/lib/site-context";
import { Stars } from "./Stars";

type R = { id: string; slug: string; product: string; rating: number; title: string; body: string; name: string; verified: boolean; image?: string };

/** "Loved by our customers": real reviews with the product they're about. */
export function ReviewsStrip({ eyebrow, title, reviews }: { eyebrow: string; title: string; reviews: R[] }) {
  const tx = useT();
  return (
    <section className="hsec container-x py-10">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>}
      <h2 className="mb-5 mt-1 text-2xl font-semibold md:text-3xl">{title}</h2>
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
        {reviews.map((r) => (
          <figure key={r.id} className="flex w-72 shrink-0 snap-start flex-col rounded-2xl border border-line bg-white p-5">
            <Stars value={r.rating} size={15} />
            {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
            <blockquote className="mt-1 line-clamp-5 flex-1 text-sm text-muted">“{r.body}”</blockquote>
            <figcaption className="mt-3 text-xs">
              <b>{r.name}</b>{r.verified && <span className="ms-1 text-green-700">✓ {tx("Verified buyer")}</span>}
            </figcaption>
            <Link href={`/products/${r.slug}/`} className="mt-3 flex items-center gap-3 rounded-xl bg-[#f7f7f7] p-2 text-xs hover:bg-[#f0f0f0]">
              {r.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgUrl(r.image, 96)} alt="" className="h-10 w-10 rounded bg-white object-contain" />
              ) : <span className="h-10 w-10 rounded bg-white" />}
              <span className="line-clamp-2 font-medium">{r.product}</span>
            </Link>
          </figure>
        ))}
      </div>
    </section>
  );
}
