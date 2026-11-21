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
    <section className="container-x py-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold md:text-3xl">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {href && (
            <Link href={href} className="mr-2 hidden text-sm font-semibold text-brand-600 hover:underline sm:block">
              {tx("View all")}
            </Link>
          )}
          <button onClick={() => scroll(-1)} aria-label={tx("Previous")} className="rounded-full border border-line p-2 hover:bg-brand-50">
            <ChevronLeft width={18} height={18} />
          </button>
          <button onClick={() => scroll(1)} aria-label={tx("Next")} className="rounded-full border border-line p-2 hover:bg-brand-50">
            <ChevronRight width={18} height={18} />
          </button>
        </div>
      </div>
      <div ref={track} className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
        {products.map((p) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[23%] lg:w-[18.5%]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
