import "server-only";

// Live shop prices (automatic sales applied) and the authoritative cart quote.

import { shopImg } from "@/lib/img-server";
import type { Every } from "@/lib/every";
import { getIndex } from "@/lib/catalog";
import type { ProductLite } from "@/lib/data/catalog";
import { inScope, isLive, quote, salePrice, type Promotions, type QuoteLine, type Settings } from "@/lib/site";
import { getPromotions, getRoutine, getSettings, getSourcing, getVisibility } from "@/lib/site-store";
import { priceMatches } from "@/lib/price-match";
import { shipInfo } from "@/lib/sourcing";
import { collectionsFor } from "@/lib/import/collection-map";
import { bucketKey, nameTokens, sameNames, stepOf, type Growth } from "@/lib/growth";
import { getGrowth, getVoucher, ratingMap, voucherRule } from "@/lib/growth-store";
import type { ProductSnap, ServerQuote } from "@/lib/store";

const g = globalThis as unknown as { __live?: { key: string; list: ProductLite[]; byId: Map<string, ProductLite>; dupOf: Map<string, string> } };

/** Same product in two catalogs → keep one listing (in stock first, then the preferred catalog or the cheapest). */
function mergeDuplicates(list: ProductLite[], prefer: Growth["dedupe"]["prefer"], preferLocal = true) {
  // Group by brand + size, then cluster names that are the same (allowing small spelling differences).
  const buckets = new Map<string, ProductLite[]>();
  for (const p of list) {
    const k = bucketKey(p);
    const arr = buckets.get(k);
    arr ? arr.push(p) : buckets.set(k, [p]);
  }
  const groups: ProductLite[][] = [];
  for (const arr of buckets.values()) {
    if (arr.length < 2 || new Set(arr.map((p) => p.source)).size < 2) continue;
    const toks = arr.map((p) => nameTokens(p));
    const used = new Set<number>();
    for (let i = 0; i < arr.length; i++) {
      if (used.has(i) || toks[i].join(" ").length < 3) continue;
      const g = [arr[i]];
      for (let j = i + 1; j < arr.length; j++) if (!used.has(j) && arr[j].source !== arr[i].source && sameNames(toks[i], toks[j])) (g.push(arr[j]), used.add(j));
      if (g.length > 1) groups.push(g);
    }
  }
  const drop = new Set<string>();
  const dupOf = new Map<string, string>(); // dropped slug → kept slug
  for (const arr of groups) {
    // In stock first, then local stock over international drop shipping, then the preferred catalog or the cheapest.
    const score = (p: ProductLite) => (p.inStock ? 0 : 1e6) + (preferLocal && p.origin === "international" ? 5e5 : 0) + (prefer !== "cheapest" && p.source === prefer ? 0 : prefer !== "cheapest" ? 1e5 : 0) + p.price - (p.image ? 0.001 : 0);
    const keep = arr.reduce((a, b) => (score(b) < score(a) ? b : a));
    for (const p of arr) if (p.source !== keep.source) (drop.add(p.id), p.slug !== keep.slug && dupOf.set(p.slug, keep.slug));
  }
  // Only drop a page when every one of its variants is a duplicate.
  const bySlug = new Map<string, ProductLite[]>();
  for (const p of list) (bySlug.get(p.slug) ?? bySlug.set(p.slug, []).get(p.slug)!).push(p);
  const keptSlugs = new Set([...bySlug.entries()].filter(([, vs]) => vs.some((v) => !drop.has(v.id))).map(([s]) => s));
  for (const s of [...dupOf.keys()]) if (keptSlugs.has(s)) dupOf.delete(s);
  return { list: list.filter((p) => !drop.has(p.id)), dupOf };
}

/** Active products with automatic sale prices applied. Cached until the catalog or promotions change. */
export async function liveProducts() {
  const [idx, promos, vis, growth, ratings, sourcing, pm] = await Promise.all([getIndex(), getPromotions(), getVisibility(), getGrowth(), ratingMap(), getSourcing(), priceMatches()]);
  const pmOn = growth.priceMatch.enabled;
  const auto = promos.discounts.filter((d) => !d.code && d.minSubtotal === 0 && isLive(d));
  // Re-evaluate at least every minute so scheduled sales start and stop on time.
  const key = `${idx.ver}|pm${pmOn ? pm.ver : 'off'}${growth.priceMatch.badge ? 'b' : ''}|${JSON.stringify(auto)}|${JSON.stringify(vis)}|${JSON.stringify(growth.dedupe)}|${JSON.stringify(sourcing)}|${ratings.size}:${[...ratings.values()].reduce((s, r) => s + r.count * r.avg, 0)}|${Math.floor(Date.now() / 60000)}`;
  if (g.__live?.key === key) return g.__live;
  const hiddenSrc = new Set(vis.hiddenSources.map((x) => x.toLowerCase()));
  const hiddenBrand = new Set(vis.hiddenBrands.map((x) => x.toLowerCase()));
  // In-clinic treatments (laser hair removal…) can't be bought online; they stay in the admin only.
  const shown = (p: ProductLite) => p.brand !== "SuperYou Clinic" && !hiddenBrand.has(p.brand.toLowerCase()) && !hiddenSrc.has((p.source || "manual").toLowerCase());
  let list = idx.all.filter((p) => p.status === "active" && shown(p)).map((p) => {
    const r = ratings.get(p.slug);
    const ship = shipInfo(p.source, sourcing);
    // Imported catalogs join the same menu collections as local stock (Make Up › Eyes › Mascara…).
    const cols = ship.origin === "international" && !p.collections?.length ? collectionsFor(p.name) : undefined;
    const q: ProductLite = { ...p, ...(r ? { rating: r.avg, reviewCount: r.count } : {}), ...(cols?.length ? { collections: cols } : {}), origin: ship.origin, shipFrom: ship.country, daysMin: ship.daysMin, daysMax: ship.daysMax };
    const s = auto.length ? salePrice(q, auto) : null;
    const sold = s?.rule ? { ...q, price: s.price, compareAt: s.compareAt } : q;
    // Price guarantee: a competitor sells it for less → match it (never below cost + margin).
    const m = pmOn ? pm.map.get(p.id) : undefined;
    const named = (all?: [string, number, boolean][]) => all?.map(([s, t, show]) => [show ? s : "", t] as [string, number]);
    if (m && m.p < sold.price - 0.005) return { ...sold, price: m.p, matchWas: sold.price, matchVs: m.t, ...(growth.priceMatch.badge ? { match: m.show ? m.s : "", shops: named(m.all), beat: m.beat ?? "full" } : {}) };
    // Already the best price: say which shop we compared with (shown as "price compared").
    const c = pmOn && growth.priceMatch.badge ? pm.cmp.get(p.id) : undefined;
    if (c && c.t >= sold.price - 0.005) return { ...sold, cmpVs: c.t, cmpShop: c.show ? c.s : "", shops: named(c.all), beat: "none" as const };
    return sold;
  });
  let dupOf = new Map<string, string>();
  if (growth.dedupe.enabled) ({ list, dupOf } = mergeDuplicates(list, growth.dedupe.prefer, sourcing.preferLocal));
  g.__live = { key, list, byId: new Map(list.map((p) => [p.id, p])), dupOf };
  return g.__live;
}

const snapOf = (p: ProductLite): ProductSnap => ({
  id: p.id, slug: p.slug, name: p.name, brand: p.brand, price: p.price, compareAt: p.compareAt, size: p.size,
  variant: p.variant, image: shopImg(p.image), match: p.match, matchWas: p.matchWas, matchVs: p.matchVs, shape: p.shape, color: p.color, inStock: p.inStock,
  origin: p.origin, shipFrom: p.shipFrom, daysMin: p.daysMin, daysMax: p.daysMax,
});

export type QuoteInput = { items: { productId: string; qty: number; every?: Every }[]; code?: string; zone?: string; giftCard?: string; subscriptionId?: string; noSuperPrice?: boolean; phone?: string; prime?: "trial" | "join" };

export async function serverQuote(input: QuoteInput): Promise<ServerQuote & { _lines: (QuoteLine & { available: boolean })[]; _promos: Promotions; _settings: Settings }> {
  const [live, basePromos, settings, idx, growth, routine] = await Promise.all([liveProducts(), getPromotions(), getSettings(), getIndex(), getGrowth(), getRoutine()]);
  const promos: Promotions = { discounts: [...basePromos.discounts], gifts: [...basePromos.gifts] };
  // Personal codes (welcome pop-up, club rewards, birthdays) become a one-off coupon rule.
  let voucherError: string | undefined;
  let ref: Awaited<ReturnType<typeof import("@/lib/growth-store").memberByRef>> = null;
  if (input.code && !promos.discounts.some((d) => d.code && d.code.toLowerCase() === input.code!.trim().toLowerCase())) {
    ref = /^REF-/i.test(input.code.trim()) && growth.club.enabled && growth.club.referral.enabled ? await (await import("@/lib/growth-store")).memberByRef(input.code) : null;
    const v = ref ? null : await getVoucher(input.code);
    const inf = ref || v ? null : await (await import("@/lib/influencers")).getInfluencer(input.code);
    if (inf?.active && inf.percentOff > 0) {
      // Influencer code: a one-off % off rule, recognised like any coupon.
      promos.discounts.push({ id: `inf-${inf.code}`, name: `${inf.code}: ${inf.percentOff}% off (with ${inf.name.split(" ")[0]})`, enabled: true, type: "percent", value: inf.percentOff, scope: { kind: "all", values: [] }, exclude: { kind: "all", values: [] }, code: inf.code, minSubtotal: inf.minSubtotal, startsAt: "", endsAt: "", stack: true, usageLimit: 0, used: 0 });
    } else if (inf && !inf.active) voucherError = "This code has ended";
    if (v) {
      const rule = voucherRule(v);
      if ("error" in rule) voucherError = rule.error;
      else promos.discounts.push(rule);
    }
  }
  // Free samples: an always-on gift choice.
  if (growth.samples.enabled && growth.samples.skus.length)
    promos.gifts.push({ id: "samples", name: growth.samples.title, enabled: true, minSubtotal: Math.max(0.01, growth.samples.minSubtotal), scope: { kind: "all", values: [] }, choices: growth.samples.skus, pick: growth.samples.pick, startsAt: "", endsAt: "", showProgress: growth.samples.minSubtotal > 0 });
  const pmCfg = growth.priceMatch;
  const lines = input.items.map(({ productId, qty }) => {
    const live0 = live.byId.get(productId);
    // SuperPrice: limited units per item, and off when the customer already used it today.
    const spOff = !!live0?.matchWas && (input.noSuperPrice || !!input.subscriptionId || qty > pmCfg.maxUnits);
    const p = live0 && spOff ? { ...live0, price: live0.matchWas!, match: undefined, matchWas: undefined, matchVs: undefined } : live0;
    const base = idx.byId.get(productId);
    return p && base
      ? { productId, superPrice: !!p.matchWas, spLimit: spOff && !input.noSuperPrice && qty > pmCfg.maxUnits ? pmCfg.maxUnits : undefined, match: p.match, matchWas: p.matchWas, matchVs: p.matchVs, name: p.name, price: p.price, basePrice: base.price, qty, category: p.category, brand: p.brand, concerns: p.concerns, tags: p.tags, sku: p.sku, available: p.inStock, compareAt: p.compareAt }
      : null;
  });
  const ok = lines.filter((l): l is NonNullable<typeof l> => !!l && l.available);
  const q = quote(ok, promos, settings, { code: ref ? undefined : input.code, zone: input.zone });
  if (voucherError) q.couponError = voucherError;
  // Referral code: a fixed amount off the friend's first order (checked again at checkout).
  if (ref) {
    const r = growth.club.referral;
    if (q.subtotal < r.friendMinSubtotal) q.couponError = `Spend at least $${r.friendMinSubtotal} to use this code`;
    else {
      const amount = +Math.min(r.friendAmount, q.subtotal - q.discountTotal).toFixed(2);
      q.discounts.push({ name: `Friend of ${ref.name.split(" ")[0]}: $${r.friendAmount} off your first order`, code: input.code!.trim().toUpperCase(), amount });
      q.discountTotal = +(q.discountTotal + amount).toFixed(2);
      const { deliveryFor } = await import("@/lib/site");
      q.delivery = deliveryFor(settings, q.subtotal - q.discountTotal, input.zone);
      q.total = +(q.subtotal - q.discountTotal + q.delivery).toFixed(2);
    }
  }
  // Routine bundle: items covering N different routine steps get an extra % off.
  let routineSteps: string[] = [];
  if (growth.bundles.enabled) {
    const steps = new Map<string, number>();
    for (const l of ok) {
      const s = stepOf({ name: l.name, category: l.category }, routine.steps);
      if (s) steps.set(s, (steps.get(s) ?? 0) + l.price * l.qty);
    }
    routineSteps = [...steps.keys()];
    if (steps.size >= growth.bundles.minSteps) {
      const spend = [...steps.values()].reduce((a, b) => a + b, 0);
      const amount = +Math.min(q.subtotal - q.discountTotal, (spend * growth.bundles.percent) / 100).toFixed(2);
      if (amount > 0) {
        q.discounts.push({ name: `Routine set: ${growth.bundles.percent}% off ${steps.size} steps`, amount });
        q.discountTotal = +(q.discountTotal + amount).toFixed(2);
        const { deliveryFor } = await import("@/lib/site");
        q.delivery = deliveryFor(settings, q.subtotal - q.discountTotal, input.zone);
        q.total = +(q.subtotal - q.discountTotal + q.delivery).toFixed(2);
      }
    }
  }
  // Subscribe & save. A new subscription pays full price: the % is EARNED after a number of delivered
  // orders (then it applies to every order, plus a one-off rebate on the orders already paid). Only a
  // subscription's own orders get it; older subscriptions keep their discount.
  if (growth.subscribe.enabled && input.subscriptionId) {
    const sp = await (await import("@/lib/subscriptions")).subscriptionPricing(input.subscriptionId);
    if (sp) {
      const spend = ok.reduce((a, l) => a + l.price * l.qty, 0);
      const amount = +Math.min(q.subtotal - q.discountTotal, (spend * sp.pct) / 100).toFixed(2);
      if (sp.pct > 0 && amount > 0) {
        q.discounts.push({ name: `Subscribe & save (−${sp.pct}%)`, amount });
        q.discountTotal = +(q.discountTotal + amount).toFixed(2);
      }
      const rebate = +Math.min(sp.rebate, q.subtotal - q.discountTotal).toFixed(2);
      if (rebate > 0) {
        q.discounts.push({ name: "Subscription rebate (earned on past orders)", amount: rebate });
        q.discountTotal = +(q.discountTotal + rebate).toFixed(2);
      }
      const { deliveryFor } = await import("@/lib/site");
      q.delivery = sp.freeShip ? 0 : deliveryFor(settings, q.subtotal - q.discountTotal, input.zone);
      q.total = +(q.subtotal - q.discountTotal + q.delivery).toFixed(2);
    }
  }
  // Subscribe & save campaign, on the order that starts a plan: a first-order % on the subscribed
  // items (SuperPrice items excluded) and free delivery.
  const { subPromoLive } = await import("@/lib/growth");
  if (growth.subscribe.enabled && !input.subscriptionId && subPromoLive(growth) && input.items.some((i) => i.every)) {
    const pr = growth.subscribe.promo!;
    const subIds = new Set(input.items.filter((i) => i.every).map((i) => i.productId));
    const spend = ok.filter((l) => subIds.has(l.productId) && !l.superPrice).reduce((a, l) => a + l.price * l.qty, 0);
    const amount = +Math.min(q.subtotal - q.discountTotal, (spend * (pr.firstPct ?? 0)) / 100).toFixed(2);
    if (amount > 0) {
      q.discounts.push({ name: `Subscribe & save: ${pr.firstPct}% off today`, amount });
      q.discountTotal = +(q.discountTotal + amount).toFixed(2);
    }
    if (pr.freeDelivery) q.delivery = 0;
    q.total = +(q.subtotal - q.discountTotal + q.delivery).toFixed(2);
  }
  // SuperPrime: members (or a shopper joining with this order) get free delivery from freeMin.
  let prime: ServerQuote["prime"];
  const pr = growth.prime;
  if (pr.enabled && !input.subscriptionId) {
    const { getPrime, primeState } = await import("@/lib/prime");
    const st = primeState(input.phone ? await getPrime(input.phone).catch(() => null) : null);
    const after = q.subtotal - q.discountTotal;
    const member = st.status === "trial" || st.status === "active";
    const { primePromoLive } = await import("@/lib/growth");
    const trialOk = !st.trialUsed && pr.trialMonths > 0 && (primePromoLive(pr) || after >= pr.trialMinOrder);
    const choice = member ? undefined : input.prime === "trial" ? (trialOk ? "trial" : undefined) : input.prime;
    const fee = choice === "join" ? pr.monthlyPrice : 0;
    const free = (member || !!choice) && after >= pr.freeMin;
    if (free) q.delivery = 0;
    q.total = +(after + q.delivery + fee).toFixed(2);
    prime = { status: st.status, until: st.until, trialUsed: st.trialUsed, trialOk, choice, fee, free, known: !!input.phone };
  }
  const bySku = new Map(live.list.map((p) => [p.sku.toLowerCase(), p]));
  const inBag = new Set(input.items.map((i) => live.byId.get(i.productId)?.slug).filter(Boolean));
  const gc = input.giftCard ? await giftCardFor(input.giftCard, q.total) : null;
  return {
    giftCard: gc && "amount" in gc ? gc : undefined,
    giftCardError: gc && "error" in gc ? gc.error : undefined,
    lines: lines.filter((l): l is NonNullable<typeof l> => !!l).map((l) => ({ productId: l.productId, price: l.price, compareAt: l.compareAt, available: l.available, ...(l.match !== undefined ? { match: l.match } : {}), ...(l.matchWas ? { matchWas: l.matchWas, matchVs: l.matchVs } : {}), ...(l.spLimit ? { spLimit: l.spLimit } : {}) })),
    subtotal: q.subtotal,
    discounts: q.discounts,
    discountTotal: q.discountTotal,
    delivery: q.delivery,
    total: q.total,
    couponError: q.couponError,
    minOrder: settings.checkout.minOrder,
    prime,
    // Gamification: routine completion meter and the double-points step of the reward ladder.
    routine: growth.bundles.enabled ? { have: routineSteps.length, need: growth.bundles.minSteps, percent: growth.bundles.percent, steps: routineSteps.map((id) => routine.steps.find((x) => x.id === id)?.name ?? id), all: routine.steps.filter((x) => x.essential || routine.steps.length <= 6).map((x) => x.name) } : null,
    doublePointsAt: growth.game?.enabled && growth.game.ladder.enabled && growth.club.enabled ? growth.game.ladder.doublePointsAt : 0,
    gifts: q.gifts.map(({ tier, unlocked, remaining }) => ({
      id: tier.id, name: tier.name, unlocked, remaining, pick: tier.pick, showProgress: tier.showProgress,
      // Samples of other products than the ones in the bag.
      options: tier.choices.map((sku) => bySku.get(sku.toLowerCase())).filter((p): p is ProductLite => !!p && !inBag.has(p.slug)).map(snapOf),
    })),
    _lines: ok,
    _promos: promos,
    _settings: settings,
  };
}

/** Which gift products the customer may take, given their cart (server check). */
export function allowedGifts(q: Awaited<ReturnType<typeof serverQuote>>, picks: { tierId: string; productIds: string[] }[]) {
  const out: ProductSnap[] = [];
  for (const pick of picks) {
    const tier = q.gifts.find((t) => t.id === pick.tierId && t.unlocked);
    if (!tier) continue;
    const chosen = pick.productIds.slice(0, tier.pick).map((id) => tier.options.find((o) => o.id === id && o.inStock)).filter((x): x is ProductSnap => !!x);
    out.push(...chosen);
  }
  return out;
}

export { inScope };

/** How much of an order total a gift card covers (shown in the cart; charged again at checkout). */
export async function giftCardFor(code: string, total: number): Promise<{ code: string; amount: number; balance: number } | { error: string }> {
  const { getGiftCard, giftCardProblem } = await import("@/lib/giftcards");
  const { getOps } = await import("@/lib/ops-store");
  if (!(await getOps()).giftCards.enabled) return { error: "Gift cards can't be used right now" };
  const gc = await getGiftCard(code);
  const problem = giftCardProblem(gc);
  if (problem || !gc) return { error: problem ?? "Gift card not found" };
  return { code: gc.code, amount: +Math.min(gc.balance, total).toFixed(2), balance: gc.balance };
}
