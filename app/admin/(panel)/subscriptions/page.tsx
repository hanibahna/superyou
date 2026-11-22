import { SubscriptionsAdmin } from "@/components/admin/SubscriptionsAdmin";
import { listSubscriptions, manageLink } from "@/lib/subscriptions";

export default async function Page() {
  const subs = await listSubscriptions();
  return <SubscriptionsAdmin subs={subs.map((s) => ({ id: s.id, status: s.status, every: s.every, nextAt: s.nextAt, name: `${s.customer.firstName} ${s.customer.lastName}`, phone: s.customer.phone, items: s.items.map((i) => `${i.qty}× ${i.name}`).join(", "), orders: s.orders, lastError: s.lastError ?? "", link: manageLink(s) }))} />;
}
