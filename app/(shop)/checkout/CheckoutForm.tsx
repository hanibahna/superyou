"use client";

import { cleanName } from "@/lib/data/catalog";
import { LinePlan } from "@/components/SubscribePlan";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { DeliverySplit, ShipBadge } from "@/components/ShipBadge";
import { PriceGuaranteeNote, PriceMatchBadge } from "@/components/PriceMatch";
import { SuperPrimeBox } from "@/components/SuperPrime";
import { CouponBox, GiftPicker, Totals } from "@/components/CartPromos";
import { DEMO_MODE } from "@/lib/config";
import { useGrowth, useSettings, useT } from "@/lib/site-context";
import { money } from "@/lib/format";
import { useShop } from "@/lib/store";
import { readAttribution, track } from "@/lib/track";
import { CheckoutAddress } from "@/components/CheckoutAddress";
import { rememberAddress } from "@/lib/addresses";

type Method = { id: "cod" | "card" | "whish"; label: string; description: string };

export function CheckoutForm({ methods }: { methods: Method[] }) {
  const tx = useT();
  const { detailed, subtotal, delivery, total, clear, code, zone, setZone, giftPicks, quote, giftCard, setGiftCard, setPrimePhone, primeChoice } = useShop();
  const formRef = useRef<HTMLFormElement>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !detailed.length) return;
    started.current = true;
    track({ type: "begin_checkout", value: subtotal, items: detailed.map((l) => ({ id: l.productId, name: l.product.name, brand: l.product.brand, price: l.product.price, qty: l.qty })) });
  }, [detailed, subtotal]);
  // Save the bag against the mobile number so the shopper can pick it up later (abandoned-cart reminder).
  const saveCart = () => {
    const f = formRef.current;
    if (!f || DEMO_MODE) return;
    const d = Object.fromEntries(new FormData(f)) as Record<string, string>;
    if (!d.phone || d.phone.replace(/\D/g, "").length < 7 || !detailed.length) return;
    fetch("/api/cart/save/", {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ phone: d.phone, name: `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim(), items: detailed.map((l) => ({ productId: l.productId, qty: l.qty })), code: code || undefined, consent: d.waOffers === "on" }),
    }).catch(() => {});
  };
  const cartKey = detailed.map((l) => `${l.productId}:${l.qty}`).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => saveCart(), [cartKey]);
  const settings = useSettings();
  const growth = useGrowth();
  const [club, setClub] = useState(true);
  const router = useRouter();
  const [method, setMethod] = useState<Method["id"]>(methods[0]?.id ?? "cod");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!detailed.length)
    return (
      <div className="container-x py-24 text-center">
        <h1 className="text-3xl font-semibold">Your cart is empty</h1>
        <Link href="/shop/" className="mt-6 inline-block rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white">Continue shopping</Link>
      </div>
    );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const payload = {
      attribution: readAttribution(),
      items: detailed.map((l) => ({ productId: l.productId, qty: l.qty, ...(l.every ? { every: l.every, ...(l.start ? { start: l.start } : {}), ...(l.forMonths ? { forMonths: l.forMonths } : {}) } : {}) })),
      customer: {
        firstName: f.firstName, lastName: f.lastName, phone: f.phone, email: f.email,
        zone: f.zone, city: f.city, address: f.address, notes: f.notes,
        ...(f.lat && f.lng ? { lat: Number(f.lat), lng: Number(f.lng) } : {}),
      },
      paymentMethod: method,
      waUpdates: f.waUpdates === "on",
      waOffers: f.waOffers === "on",
      joinClub: growth.club.enabled && f.joinClub === "on",
      ...(primeChoice && quote?.prime?.choice === primeChoice ? { prime: primeChoice } : {}),
      birthday: f.bdMonth && f.bdDay ? `${f.bdMonth.padStart(2, "0")}-${f.bdDay.padStart(2, "0")}` : "",
      code: code || undefined,
      giftCard: quote?.giftCard ? giftCard : undefined,
      gifts: Object.entries(giftPicks).filter(([id]) => quote?.gifts.some((g) => g.id === id && g.unlocked)).map(([tierId, productIds]) => ({ tierId, productIds })),
    };

    if (DEMO_MODE) {
      // Static preview: no server, so simulate the order locally.
      const id = `DEMO-${Date.now().toString(36).toUpperCase()}`;
      const order = {
        id,
        status: method === "cod" ? "pending_cod" : method === "card" ? "paid" : "awaiting_payment",
        paymentMethod: method,
        lines: detailed.map((l) => ({ productId: l.productId, name: l.product.name, brand: l.product.brand, unitPrice: l.product.price, qty: l.qty, lineTotal: l.lineTotal })),
        subtotal, delivery, total, currency: "USD", customer: payload.customer, createdAt: new Date().toISOString(),
      };
      try { sessionStorage.setItem(`order:${id}`, JSON.stringify(order)); } catch {}
      clear();
      router.push(`/order/?id=${id}&demo=1`);
      return;
    }

    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      // Keep the address on this phone for next time.
      rememberAddress({ label: f.addressLabel || undefined, zone: f.zone, city: f.city, address: f.address, notes: f.notes || undefined, ...(f.lat && f.lng ? { lat: Number(f.lat), lng: Number(f.lng) } : {}) });
      clear();
      setGiftCard("");
      window.location.href = data.next.redirect; // full navigation: may leave the site for a payment page
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-line px-4 py-3 text-sm outline-none focus:border-brand-500";

  return (
    <div className="container-x py-10">
      <h1 className="text-3xl font-semibold">{tx("Checkout")}</h1>
      <form ref={formRef} onSubmit={submit} onBlur={(e) => { const el = e.target as unknown as HTMLInputElement; if (el.name === "phone") setPrimePhone(el.value.replace(/\D/g, "").length >= 7 ? el.value : ""); if (["phone", "firstName", "waOffers"].includes(el.name)) saveCart(); }} className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-8">
          <fieldset className="min-w-0">
            <legend className="mb-3 text-lg font-semibold">{tx("1. Contact")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="firstName" required placeholder={tx("First name")} aria-label={tx("First name")} autoComplete="given-name" className={input} />
              <input name="lastName" required placeholder="Last name" aria-label="Last name" autoComplete="family-name" className={input} />
              <input name="phone" required type="tel" placeholder="Mobile (e.g. 03 123 456)" aria-label="Mobile (e.g. 03 123 456)" autoComplete="tel" className={input} />
              <input name="email" type="email" placeholder={tx("Email (optional, for receipt)")} aria-label={tx("Email (optional, for receipt)")} autoComplete="email" className={input} />
            </div>
          </fieldset>

          <fieldset className="min-w-0">
            <legend className="mb-3 text-lg font-semibold">2. Delivery address</legend>
            <CheckoutAddress form={formRef} setZone={setZone} />
            <div className="grid gap-3 sm:grid-cols-2">
              <select name="zone" required value={zone} onChange={(e) => setZone(e.target.value)} className={input}>
                <option value="" disabled>{tx("Area")}</option>
                {settings.delivery.zones.map((z) => <option key={z.name} value={z.name}>{z.name}{z.fee !== undefined ? ` (delivery $${z.fee})` : ""}</option>)}
              </select>
              <input name="city" required placeholder="Town / neighbourhood" aria-label="Town / neighbourhood" className={input} />
              <input name="address" required placeholder={tx("Street, building, floor, landmark")} aria-label={tx("Street, building, floor, landmark")} className={`${input} sm:col-span-2`} />
              <textarea name="notes" placeholder="Delivery notes (optional)" aria-label="Delivery notes (optional)" rows={2} className={`${input} sm:col-span-2`} />
              <div className="space-y-2 text-sm sm:col-span-2">
                <label className="flex items-start gap-2"><input type="checkbox" name="waUpdates" defaultChecked className="mt-0.5" /> {tx("Send me order updates on WhatsApp")}</label>
                <label className="flex items-start gap-2"><input type="checkbox" name="waOffers" className="mt-0.5" /> {tx("Send me offers and new arrivals on WhatsApp (reply STOP anytime)")}</label>
                {growth.club.enabled && (
                  <div className="rounded-xl border border-line p-3">
                    <label className="flex items-start gap-2 font-medium">
                      <input type="checkbox" name="joinClub" checked={club} onChange={(e) => setClub(e.target.checked)} className="mt-0.5" />
                      <span>Join {growth.club.name} and earn {Math.floor((total - delivery) * growth.club.pointsPerDollar)} points on this order <span className="block text-xs font-normal text-muted">Every {growth.club.rewardPoints} points = a ${growth.club.rewardValue} voucher on WhatsApp. Free.</span></span>
                    </label>
                    {club && (
                      <div className="mt-2 flex items-center gap-2 ps-6 text-xs text-muted">
                        Birthday gift (optional):
                        <select name="bdDay" className="rounded border border-line px-1 py-1" defaultValue=""><option value="">{tx("Day")}</option>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
                        <select name="bdMonth" className="rounded border border-line px-1 py-1" defaultValue=""><option value="">{tx("Month")}</option>{["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-muted">🚚 Estimated delivery: {settings.delivery.estimate}</p>
          </fieldset>

          <fieldset className="min-w-0">
            <legend className="mb-3 text-lg font-semibold">3. Payment</legend>
            <div className="space-y-3">
              {methods.map((m) => (
                <label key={m.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${method === m.id ? "border-brand-500 bg-brand-50" : "border-line"}`}>
                  <input type="radio" name="method" checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-1 accent-[var(--color-brand-500)]" />
                  <span>
                    <span className="block font-semibold">{m.label}</span>
                    <span className="block text-sm text-muted">{m.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {DEMO_MODE && <p className="mt-2 text-xs text-muted">Preview mode: no real payment is taken.</p>}
          </fieldset>
          <GiftPicker />
          <SuperPrimeBox />
          {settings.checkout.note && <p className="rounded-lg bg-brand-50 p-3 text-sm">{settings.checkout.note}</p>}
        </div>

        <aside className="summary-box h-fit rounded-2xl border border-line p-6 lg:sticky lg:top-32">
          <h2 className="text-lg font-semibold">{tx("Order summary")}</h2>
          <ul className="mt-4 space-y-3">
            {detailed.map(({ product, qty, lineTotal, every, start, forMonths }) => (
              <li key={product.id} className="flex items-center gap-3 text-sm">
                <span className="relative">
                  <ProductImage product={product} className="h-14 w-14 rounded-lg" />
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] text-white">{qty}</span>
                </span>
                <span className="flex-1 leading-snug">{cleanName(product.name)}{product.variant && <span className="block text-xs text-muted">{product.variant}</span>}<ShipBadge p={product} className="mt-1" /><PriceMatchBadge p={product} className="ml-1 mt-1" /><LinePlan name={product.name} productId={product.id} every={every} start={start} forMonths={forMonths} readOnly /></span>
                <span className="font-medium">{money(lineTotal)}</span>
              </li>
            ))}
          </ul>
          {quote?.gifts.some((g) => g.unlocked) && (
            <ul className="mt-3 space-y-1 text-sm text-brand-700">
              {quote.gifts.filter((g) => g.unlocked).flatMap((g) => (giftPicks[g.id] ?? []).map((id) => g.options.find((o) => o.id === id)).filter(Boolean).map((o) => (
                <li key={o!.id}>🎁 FREE: {o!.name}</li>
              )))}
            </ul>
          )}
          <DeliverySplit items={detailed.map((l) => l.product)} className="mt-4" />
          <PriceGuaranteeNote items={detailed.map((l) => ({ ...l.product, qty: l.qty }))} className="mt-3" />
          <div className="mt-4 border-t border-line pt-4"><CouponBox /></div>
          <div className="mt-4"><Totals /></div>
          {error && <p className="mt-4 rounded-lg bg-sale/10 p-3 text-sm text-sale">{error}</p>}
          <button disabled={busy || (settings.checkout.minOrder > 0 && subtotal < settings.checkout.minOrder)} className="mt-5 w-full rounded-lg bg-brand-500 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
            {busy ? tx("Placing order…") : method === "card" ? `Pay ${money(total)}` : tx("Place order")}
          </button>
          {method === "card" && <p className="mt-3 text-center text-xs text-muted">{tx("🔒 Card details are entered on the bank's secure page — never on this site.")}</p>}
        </aside>
      </form>
    </div>
  );
}
