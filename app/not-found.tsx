import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";

export const metadata = { title: "Page not found", robots: { index: false, follow: true } };

// Shown for any address that doesn't exist (an old link, a typo, a product that was removed).
export default function NotFound() {
  return (
    <div className="container-x py-16 md:py-24">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-brand-600">404</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">We couldn&rsquo;t find that page</h1>
        <p className="mt-3 text-muted">The link may be old, or the product may have moved. Search for it, or start from one of these.</p>
        <div className="mt-6 text-start"><SearchBox /></div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/shop/" className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">Shop all</Link>
          <Link href="/brands/" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold">Brands A–Z</Link>
          <Link href="/routine/" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold">Find my routine</Link>
          <Link href="/" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold">Home</Link>
        </div>
      </div>
    </div>
  );
}
