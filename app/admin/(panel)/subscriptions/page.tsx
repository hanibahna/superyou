import { SubscriptionsAdmin } from "@/components/admin/SubscriptionsAdmin";
import { getGrowth } from "@/lib/growth-store";
import { listSubscriptions, manageLink, progress } from "@/lib/subscriptions";

export default async function Page() {
  const [subs, g] = await Promise.all([listSubscriptions(), getGrowth()]);
  const ph = (p: string) => p.replace(/\D/g, "");
  const addr = (s: (typeof subs)[number]) => `${s.customer.city}|${s.customer.address}`.toLowerCase().replace(/\s+/g, " ").trim();
  // Abuse signals: several subscriptions on one phone, one address used by several phones, cancellations, returns.
  const byPhone = new Map<string, number>(), cancels = new Map<string, number>(), phonesAt = new Map<string, Set<string>>();
  for (const s of subs) {
    byPhone.set(ph(s.customer.phone), (byPhone.get(ph(s.customer.phone)) ?? 0) + 1);
    if (s.status === "cancelled") cancels.set(ph(s.customer.phone), (cancels.get(ph(s.customer.phone)) ?? 0) + 1);
    if (!phonesAt.has(addr(s))) phonesAt.set(addr(s), new Set());
    phonesAt.get(addr(s))!.add(ph(s.customer.phone));
  }
  const flags = (s: (typeof subs)[number]) => {
    const f: string[] = [];
    if ((byPhone.get(ph(s.customer.phone)) ?? 0) > 1) f.push(`${byPhone.get(ph(s.customer.phone))} subscriptions on this phone`);
    if ((cancels.get(ph(s.customer.phone)) ?? 0) > 0 && s.status !== "cancelled") f.push(`${cancels.get(ph(s.customer.phone))} cancelled before`);
    if ((phonesAt.get(addr(s))?.size ?? 0) > 1) f.push(`same address as ${phonesAt.get(addr(s))!.size - 1} other phone(s)`);
    const returns = (s.log ?? []).filter((l) => / returned| cancelled:/.test(l.text)).length;
    if (returns) f.push(`${returns} returned/cancelled order(s)`);
    if (s.noRebate) f.push("no rebate: re-subscribed within cooldown");
    return f;
  };
  return (
    <SubscriptionsAdmin
      rules={{ monthly: g.subscribe.monthly, quarterly: g.subscribe.quarterly, unlockMonthly: g.subscribe.unlockMonthly, unlockQuarterly: g.subscribe.unlockQuarterly, maxRebate: g.subscribe.maxRebate, cooldownDays: g.subscribe.cooldownDays }}
      subs={subs.map((s) => ({ id: s.id, status: s.status, every: s.every, nextAt: s.nextAt, name: `${s.customer.firstName} ${s.customer.lastName}`, phone: s.customer.phone, items: s.items.map((i) => `${i.qty}× ${i.name}`).join(", "), orders: s.orders, lastError: s.lastError ?? "", link: manageLink(s), progress: progress(s, g.subscribe), flags: flags(s), log: (s.log ?? []).slice(-8).reverse() }))}
    />
  );
}
