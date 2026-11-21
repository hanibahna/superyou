import type { ReactNode } from "react";

// Placeholder packshot drawn in SVG, so the skeleton needs no image assets.
// Replace with <Image src={product.image} …/> once real photos exist.
import type { Product } from "@/lib/data/catalog";
import { imgUrl } from "@/lib/img";

export function ProductImage({
  product,
  className = "",
  width = 600,
}: {
  product: Pick<Product, "shape" | "color" | "brand"> & { images?: string[]; image?: string; name?: string };
  className?: string;
  width?: number;
}) {
  const src = product.image ?? product.images?.[0];
  if (src)
    return (
      // Uniform frame: every photo sits on the same background with the same margin;
      // multiply blending makes white photo backgrounds melt into it (Admin → Growth → Product photos).
      <span className={`pframe block overflow-hidden ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgUrl(src, width)} alt={`${product.brand} ${product.name ?? ""}`.trim()} loading="lazy" className="h-full w-full object-contain mix-blend-multiply" />
      </span>
    );
  const c = product.color;
  const label = product.brand.toUpperCase();
  const shapes: Record<Product["shape"], ReactNode> = {
    bottle: (
      <>
        <rect x="82" y="40" width="36" height="22" rx="4" fill="#fff" stroke="#d9dedb" />
        <rect x="62" y="60" width="76" height="120" rx="14" fill={c} />
      </>
    ),
    tube: (
      <>
        <path d="M70 40h60l-6 120H76L70 40Z" fill={c} />
        <rect x="80" y="160" width="40" height="24" rx="4" fill="#fff" stroke="#d9dedb" />
      </>
    ),
    jar: (
      <>
        <rect x="52" y="88" width="96" height="22" rx="6" fill="#fff" stroke="#d9dedb" />
        <rect x="56" y="108" width="88" height="70" rx="12" fill={c} />
      </>
    ),
    dropper: (
      <>
        <rect x="92" y="28" width="16" height="22" rx="8" fill="#3a3f3c" />
        <rect x="86" y="48" width="28" height="18" rx="3" fill="#fff" stroke="#d9dedb" />
        <rect x="70" y="64" width="60" height="114" rx="10" fill={c} />
      </>
    ),
    spray: (
      <>
        <rect x="88" y="34" width="24" height="14" rx="3" fill="#fff" stroke="#d9dedb" />
        <rect x="84" y="46" width="32" height="14" rx="3" fill="#fff" stroke="#d9dedb" />
        <rect x="66" y="58" width="68" height="122" rx="20" fill={c} />
      </>
    ),
    box: <rect x="56" y="50" width="88" height="130" rx="6" fill={c} />,
    tub: (
      <>
        <rect x="58" y="70" width="84" height="20" rx="6" fill="#fff" stroke="#d9dedb" />
        <rect x="62" y="88" width="76" height="92" rx="10" fill={c} />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={`${product.brand} product image placeholder`}>
      <rect width="200" height="200" fill="#f6f7f6" />
      <ellipse cx="100" cy="184" rx="52" ry="5" fill="#000" opacity=".06" />
      {shapes[product.shape]}
      <rect x="76" y="124" width="48" height="26" rx="3" fill="#fff" opacity=".85" />
      <text x="100" y="141" textAnchor="middle" fontSize="8" fontWeight="700" fill="#333" fontFamily="system-ui" letterSpacing="1">
        {label.slice(0, 9)}
      </text>
    </svg>
  );
}
