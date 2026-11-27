"use client";

import { useT } from "@/lib/site-context";

import Link from "next/link";
import { useRef } from "react";
import type { CardItem } from "@/lib/listing";
import { ChevronLeft, ChevronRight } from "./Icons";
import { ProductCard } from "./ProductCard";

export function ProductCarousel({
  eyebrow,
  title,
  products,
  href,
}: {
  eyebrow: string;
  title: string;
  products: CardItem[];
  href?: string;
}) {
  const tx = useT();
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: "smooth" });

  if (!products.length) return null;
  return (
    <section className="container-x py-7 md:py-10">
      <div className="mb-4 flex items-end justify-between gap-4 md:mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold md:text-3xl">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {href && (
            <Link href={href} className="me-0 shrink-0 text-sm font-semibold text-brand-600 hover:underline md:me-2">
              {tx("View all")}
            </Link>
          )}
          <button onClick={() => scroll(-1)} aria-label={tx("Previous")} className="hidden rounded-full border border-line p-2 hover:bg-brand-50 md:block">
            <ChevronLeft width={18} height={18} />
          </button>
          <button onClick={() => scroll(1)} aria-label={tx("Next")} className="hidden rounded-full border border-line p-2 hover:bg-brand-50 md:block">
            <ChevronRight width={18} height={18} />
          </button>
        </div>
      </div>
      <div ref={track} className="bleed no-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2 md:-mx-1 md:gap-4 md:px-1">
        {products.map((p) => (
          <div key={p.id} className="w-[44%] shrink-0 snap-start sm:w-[31%] md:w-[23%] lg:w-[18.5%]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
