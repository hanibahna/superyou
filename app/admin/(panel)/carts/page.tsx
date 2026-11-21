import Link from "next/link";
import { CartRowActions } from "@/components/admin/CartRowActions";
import { requireAdmin } from "@/lib/admin-auth";
import { listCarts, restoreLink } from "@/lib/carts";
import { money } from "@/lib/format";
import { getOps } from "@/lib/ops-store";
import { getWaConfig } from "@/lib/whatsapp";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

export default async function CartsPage() {
  await requireAdmin("orders");
  const [carts, ops, wa] = await Promise.all([listCarts(), getOps(), getWaConfig()]);
  const open = carts.filter((c) => c.status !== "recovered");
  const recovered = carts.filter((c) => c.status === "recovered");
  const auto = wa.automations.cartReminder;
  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/orders/" className="text-sm text-muted hover:underline">← Orders</Link>
        <h1 className="text-2xl font-semibold">Abandoned carts</h1>
        <p className="text-sm text-muted">
          Saved when a shopper types their mobile at checkout but doesn&apos;t order. {ops.carts.enabled ? `After ${ops.carts.afterHours} h, people who ticked "WhatsApp offers" get one reminder with a link that refills their bag` : "Automatic reminders are off"}
          {" "}(template &quot;{auto.template}&quot;, {auto.enabled && wa.live ? "on" : wa.live ? "switched off in WhatsApp" : "WhatsApp is in test mode"}). Settings in <Link href="/admin/operations/" className="underline">Operations</Link>.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-muted">Open carts</p><p className="text-2xl font-bold">{open.length}</p><p className="text-xs text-muted">{money(open.reduce((s, c) => s + c.value, 0))} in bags</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-muted">Reminded</p><p className="text-2xl font-bold">{carts.filter((c) => c.remindedAt).length}</p></div>
        <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-muted">Recovered after a reminder</p><p className="text-2xl font-bold">{recovered.length}</p><p className="text-xs text-muted">{money(recovered.reduce((s, c) => s + c.value, 0))}</p></div>
      </div>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted"><tr><th className="p-3">Shopper</th><th className="p-3">Bag</th><th className="p-3 text-right">Value</th><th className="p-3">Last seen</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-line align-top">
            {carts.map((c) => (
              <tr key={c.phone}>
                <td className="p-3">{c.name || "—"}<span className="block text-xs text-muted">+{c.phone}{c.consent ? " · OK for offers" : ""}</span></td>
                <td className="p-3">{c.items.map((i) => <span key={i.productId} className="block">{i.qty}× {i.name}</span>)}</td>
                <td className="p-3 text-right font-medium">{money(c.value)}</td>
                <td className="p-3 whitespace-nowrap text-muted">{ago(c.updatedAt)}</td>
                <td className="p-3">{c.status === "recovered" ? <Link href={`/admin/orders/${c.orderId}/`} className="font-semibold text-brand-700 underline">Ordered {c.orderId}</Link> : c.status === "reminded" ? `Reminded ${ago(c.remindedAt!)}` : "Open"}</td>
                <td className="p-3"><CartRowActions phone={c.phone} name={c.name} link={restoreLink(c)} /></td>
              </tr>
            ))}
            {!carts.length && <tr><td colSpan={6} className="p-10 text-center text-muted">No abandoned carts yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
