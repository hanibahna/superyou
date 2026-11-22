import { InfluencersAdmin } from "@/components/admin/InfluencersAdmin";
import { getGrowth } from "@/lib/growth-store";
import { influencerStats, listInfluencers } from "@/lib/influencers";
import { getOrder } from "@/lib/orders";

const DONE = new Set(["delivered", "paid", "shipped", "confirmed"]);
const VOID = new Set(["cancelled", "returned", "payment_failed"]);

export default async function Page() {
  const [list, growth] = await Promise.all([listInfluencers(), getGrowth()]);
  const rows = await Promise.all(list.map(async (i) => {
    const s = await influencerStats(i.code);
    const sales = await Promise.all(s.sales.slice(0, 300).map(async (x) => ({ ...x, status: (await getOrder(x.orderId).catch(() => null))?.status ?? "unknown" })));
    const valid = sales.filter((x) => !VOID.has(x.status));
    const earned = valid.filter((x) => x.status === "delivered").reduce((a, x) => a + x.commission, 0);
    const pending = valid.filter((x) => x.status !== "delivered").reduce((a, x) => a + x.commission, 0);
    return { ...i, clicks: s.clicks, orders: valid.length, revenue: +valid.reduce((a, x) => a + x.net, 0).toFixed(2), earned: +earned.toFixed(2), pending: +pending.toFixed(2), owed: +Math.max(0, earned - i.paid).toFixed(2), recent: sales.slice(0, 10).map((x) => ({ orderId: x.orderId, at: x.at, net: x.net, commission: x.commission, status: x.status, done: DONE.has(x.status) })) };
  }));
  return <InfluencersAdmin rows={rows} referral={growth.club.referral} clubOn={growth.club.enabled} site={process.env.NEXT_PUBLIC_SITE_URL || "https://www.shopsuperyou.com"} />;
}
