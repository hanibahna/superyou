"use client";

import { useT } from "@/lib/site-context";

import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { useShop } from "@/lib/store";

export default function WishlistPage() {
  const tx = useT();
  const { wishlist } = useShop();
  return (
    <div className="container-x py-10">
      <h1 className="text-3xl font-semibold">{tx("Wishlist")}</h1>
      {wishlist.length === 0 ? (
        <p className="mt-4 text-muted">
          Nothing saved yet. Tap the heart on any product. <Link href="/shop/" className="text-brand-600 underline">{tx("Browse products")}</Link>
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {wishlist.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
