import { MarketingEditor, type CampaignStat, type SourceStat } from "@/components/admin/MarketingEditor";
import { MASK, SECRET_KEYS } from "@/lib/marketing";
import { listOrders, orderValue } from "@/lib/orders";
import { getMarketing } from "@/lib/site-store";
import { siteUrl } from "@/lib/site-url";

const NOT_SALES = new Set(["payment_failed", "cancelled", "returned", "awaiting_payment"]);

export default async function MarketingPage() {
  const [m, { orders }] = await Promise.all([getMarketing(), listOrders(0, 3000)]);
  // Secrets never go to the browser: the page only learns whether one is saved.
  const tracking = { ...m.tracking };
  for (const k of SECRET_KEYS) tracking[k] = tracking[k] ? MASK : "";

  const since = Date.now() - 90 * 864e5;
  const sales = orders.filter((o) => !NOT_SALES.has(o.status));
  const stats: Record<string, CampaignStat> = {};
  for (const c of m.campaigns) {
    const slug = (c.slug || "").toLowerCase();
    const code = c.coupon.trim().toUpperCase();
    const hit = sales.filter((o) => (slug && o.attribution?.campaign?.toLowerCase() === slug) || (code && (o.code ?? "").toUpperCase() === code));
    stats[c.id] = { orders: hit.length, revenue: +hit.reduce((s, o) => s + orderValue(o), 0).toFixed(2) };
  }
  const bySource = new Map<string, SourceStat>();
  for (const o of sales.filter((o) => Date.parse(o.createdAt) >= since)) {
    const a = o.attribution;
    const key = a?.source ? `${a.source} / ${a.medium || "–"}` : "Direct / unknown";
    const s = bySource.get(key) ?? { source: key, orders: 0, revenue: 0 };
    s.orders++;
    s.revenue = +(s.revenue + orderValue(o)).toFixed(2);
    bySource.set(key, s);
  }
  return <MarketingEditor initial={{ ...m, tracking }} stats={stats} sources={[...bySource.values()].sort((a, b) => b.revenue - a.revenue)} base={siteUrl()} />;
}
