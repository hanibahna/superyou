"use client";

// Client-side cart + wishlist, persisted in localStorage.
// Each line keeps a snapshot of the product for display; the server
// re-prices everything from the live catalog at checkout.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { firstImage, type AnyProduct } from "@/lib/data/catalog";
import { deliveryFor } from "@/lib/site";
import { useSettings } from "@/lib/site-context";
import { track } from "@/lib/track";

export type ProductSnap = {
  id: string; slug: string; name: string; brand: string; price: number; compareAt?: number;
  size: string; variant?: string; image?: string; shape: AnyProduct["shape"]; color: string; inStock: boolean;
  origin?: "local" | "international"; shipFrom?: string; daysMin?: number; daysMax?: number;
};

export const snap = (p: AnyProduct | ProductSnap): ProductSnap => ({
  id: p.id, slug: p.slug, name: p.name, brand: p.brand, price: p.price, compareAt: p.compareAt,
  size: p.size, variant: p.variant, image: firstImage(p as { image?: string; images?: string[] }), shape: p.shape, color: p.color, inStock: p.inStock,
  ...("origin" in p && p.origin ? { origin: p.origin, shipFrom: p.shipFrom, daysMin: p.daysMin, daysMax: p.daysMax } : {}),
});

/** every: subscription interval in months (1 or 3); none = one-time purchase. */
export type CartLine = { productId: string; qty: number; product: ProductSnap; every?: 1 | 3 };

/** What the server says the cart costs (sale prices, coupon, gifts, delivery). */
export type ServerQuote = {
  lines: { productId: string; price: number; compareAt?: number; available: boolean }[];
  subtotal: number;
  discounts: { name: string; code?: string; amount: number }[];
  discountTotal: number;
  delivery: number;
  total: number;
  couponError?: string;
  giftCard?: { code: string; amount: number; balance: number };
  giftCardError?: string;
  minOrder: number;
  gifts: { id: string; name: string; unlocked: boolean; remaining: number; pick: number; showProgress: boolean; options: ProductSnap[] }[];
};

type ShopState = {
  lines: CartLine[];
  wishlist: ProductSnap[];
  add: (product: AnyProduct | ProductSnap, qty?: number, every?: 1 | 3 | null) => void;
  setEvery: (productId: string, every?: 1 | 3) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  toggleWish: (product: AnyProduct | ProductSnap) => void;
  isWished: (productId: string) => boolean;
  count: number;
  detailed: Array<CartLine & { lineTotal: number }>;
  subtotal: number;
  delivery: number;
  total: number;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  addMany: (products: (AnyProduct | ProductSnap)[]) => void;
  code: string;
  setCode: (c: string) => void;
  giftCard: string;
  setGiftCard: (c: string) => void;
  giftCardAmount: number;
  zone: string;
  setZone: (z: string) => void;
  giftPicks: Record<string, string[]>; // tier id → chosen product ids
  toggleGift: (tierId: string, productId: string, pick: number) => void;
  quote: ServerQuote | null;
  discountTotal: number;
};

const ShopContext = createContext<ShopState | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — keep in memory only */
  }
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<ProductSnap[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [code, setCode] = useState("");
  const [giftCard, setGiftCard] = useState("");
  const [zone, setZone] = useState("");
  const [giftPicks, setGiftPicks] = useState<Record<string, string[]>>({});
  const [quote, setQuote] = useState<ServerQuote | null>(null);
  const settings = useSettings();

  useEffect(() => {
    // v2 keys: older carts stored ids only.
    setLines(load<CartLine[]>("cart:v3", []).filter((l) => l?.product?.id));
    setWishlist(load<ProductSnap[]>("wishlist:v3", []).filter((p) => p?.id));
    const extra = load<{ code?: string; zone?: string; gifts?: Record<string, string[]>; giftCard?: string }>("cart-extra:v1", {});
    setCode(extra.code ?? "");
    setGiftCard(extra.giftCard ?? "");
    setZone(extra.zone ?? "");
    setGiftPicks(extra.gifts ?? {});
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) save("cart-extra:v1", { code, zone, gifts: giftPicks, giftCard });
  }, [code, zone, giftPicks, giftCard, hydrated]);

  // Ask the server for live prices, promotions and free-gift eligibility.
  useEffect(() => {
    if (!hydrated) return;
    if (!lines.length) return setQuote(null);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch("/api/cart/quote/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines.map((l) => ({ productId: l.productId, qty: l.qty, ...(l.every ? { every: l.every } : {}) })), code, zone, giftCard: giftCard || undefined }),
        signal: ctl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((q: ServerQuote | null) => {
          if (!q) return;
          setQuote(q);
          // Keep the displayed prices in step with the shop (sales start and end).
          setLines((prev) => {
            let changed = false;
            const next = prev.map((l) => {
              const s = q.lines.find((x) => x.productId === l.productId);
              if (!s || (s.price === l.product.price && s.compareAt === l.product.compareAt)) return l;
              changed = true;
              return { ...l, product: { ...l.product, price: s.price, compareAt: s.compareAt } };
            });
            return changed ? next : prev;
          });
        })
        .catch(() => {});
    }, 250);
    return () => (clearTimeout(t), ctl.abort());
  }, [lines, code, zone, giftCard, hydrated]);

  useEffect(() => {
    if (hydrated) save("cart:v3", lines);
  }, [lines, hydrated]);
  useEffect(() => {
    if (hydrated) save("wishlist:v3", wishlist);
  }, [wishlist, hydrated]);

  const value = useMemo<ShopState>(() => {
    const detailed = lines.map((l) => ({ ...l, lineTotal: +(l.product.price * l.qty).toFixed(2) }));
    const subtotal = +detailed.reduce((s, l) => s + l.lineTotal, 0).toFixed(2);
    const fresh = quote && Math.abs(quote.subtotal - subtotal) < 0.01;
    const discountTotal = fresh ? quote.discountTotal : 0;
    const delivery = fresh ? quote.delivery : deliveryFor(settings, subtotal, zone);
    const giftCardAmount = fresh && quote.giftCard ? quote.giftCard.amount : 0;
    const add = (product: AnyProduct | ProductSnap, qty = 1, every?: 1 | 3 | null) => {
      const s = snap(product);
      setLines((prev) => {
        const found = prev.find((l) => l.productId === s.id);
        // Adding from the product page sets the delivery plan; a plain "add" keeps whatever was chosen.
        return found
          ? prev.map((l) => (l.productId === s.id ? { ...l, qty: l.qty + qty, product: s, ...(every !== undefined ? { every: every ?? undefined } : {}) } : l))
          : [...prev, { productId: s.id, qty, product: s, ...(every ? { every } : {}) }];
      });
    };
    return {
      lines,
      wishlist,
      setEvery: (productId, every) => setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, every } : l))),
      add: (product, qty = 1, every) => {
        add(product, qty, every);
        track({ type: "add_to_cart", item: { id: product.id, name: product.name, brand: product.brand, price: product.price, qty } });
        setDrawerOpen(true);
      },
      addMany: (products) => {
        products.forEach((p) => add(p, 1));
        setDrawerOpen(true);
      },
      code,
      setCode,
      giftCard,
      setGiftCard,
      giftCardAmount,
      zone,
      setZone,
      giftPicks,
      toggleGift: (tierId, productId, pick) =>
        setGiftPicks((prev) => {
          const cur = prev[tierId] ?? [];
          if (cur.includes(productId)) return { ...prev, [tierId]: cur.filter((x) => x !== productId) };
          return { ...prev, [tierId]: pick === 1 ? [productId] : [...cur, productId].slice(-pick) };
        }),
      quote: fresh ? quote : null,
      discountTotal,
      setQty: (productId, qty) =>
        setLines((prev) =>
          qty <= 0 ? prev.filter((l) => l.productId !== productId) : prev.map((l) => (l.productId === productId ? { ...l, qty } : l)),
        ),
      remove: (productId) => setLines((prev) => prev.filter((l) => l.productId !== productId)),
      clear: () => setLines([]),
      toggleWish: (product) =>
        setWishlist((prev) => (prev.some((p) => p.id === product.id) ? prev.filter((p) => p.id !== product.id) : [...prev, snap(product)])),
      isWished: (productId) => wishlist.some((p) => p.id === productId),
      count: lines.reduce((s, l) => s + l.qty, 0),
      detailed,
      subtotal,
      delivery,
      total: Math.max(0, +(subtotal - discountTotal + delivery - giftCardAmount).toFixed(2)),
      drawerOpen,
      setDrawerOpen,
    };
  }, [lines, wishlist, drawerOpen, code, giftCard, zone, giftPicks, quote, settings]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside <ShopProvider>");
  return ctx;
}
