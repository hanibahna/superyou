import Link from "next/link";
import { CatalogActions } from "@/components/admin/CatalogActions";
import { requireAdmin } from "@/lib/admin-auth";
import { getOps } from "@/lib/ops-store";
import { can } from "@/lib/roles";
import { getAllProducts } from "@/lib/catalog";
import { money } from "@/lib/format";
import { listOrders, statusLabels } from "@/lib/orders";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const me = await requireAdmin();
  const denied = !!(await searchParams).denied;
  const [products, { orders, total }, ops] = await Promise.all([getAllProducts(), listOrders(0, 100), getOps()]);
  const active = products.filter((p) => p.status === "active").length;
  const soldOut = products.filter((p) => !p.inStock).length;
  const lowStock = products.filter((p) => p.stock !== undefined && p.stock > 0 && p.stock <= ops.stock.lowAt);
  const since = Date.now() - 30 * 86400_000;
  const live = orders.filter((o) => Date.parse(o.createdAt) >= since && !["cancelled", "payment_failed", "returned"].includes(o.status));
  const revenue = live.reduce((s, o) => s + o.total, 0);
  const open = orders.filter((o) => ["pending_cod", "paid", "confirmed", "packed"].includes(o.status)).length;

  const stats = [
    ...(can(me.role, "sales") ? [{ label: "Sales, last 30 days", value: money(revenue), sub: `${live.length} order${live.length === 1 ? "" : "s"}`, href: "/admin/sales/" }] : []),
    { label: "Orders to handle", value: String(open), sub: `${total} order${total === 1 ? "" : "s"} in total`, href: "/admin/orders/" },
    { label: "Live products", value: String(active), sub: `${products.length - active} drafts`, href: "/admin/products/" },
    { label: "Sold out", value: String(soldOut), sub: `${lowStock.length} running low`, href: "/admin/inventory/?show=out" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {denied && <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">Your account doesn&apos;t have access to that page. Ask the owner if you need it.</p>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const inner = (
            <>
              <p className="text-xs text-muted">{s.label}</p>
              <p className="mt-1 text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted">{s.sub}</p>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="rounded-xl bg-white p-5 shadow-sm hover:shadow">{inner}</Link>
          ) : (
            <div key={s.label} className="rounded-xl bg-white p-5 shadow-sm">{inner}</div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Latest orders</h2>
            <Link href="/admin/orders/" className="text-sm text-brand-600 hover:underline">All orders</Link>
          </div>
          {orders.length === 0 ? (
            <p className="py-6 text-sm text-muted">No orders yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {orders.slice(0, 8).map((o) => (
                  <tr key={o.id}>
                    <td className="py-2.5"><Link href={`/admin/orders/${o.id}/`} className="font-medium text-brand-700 hover:underline">{o.id}</Link></td>
                    <td className="py-2.5">{o.customer.firstName} {o.customer.lastName}</td>
                    <td className="py-2.5 text-muted">{statusLabels[o.status]}</td>
                    <td className="py-2.5 text-right font-medium">{money(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="space-y-4">
          {can(me.role, "catalog") && <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Quick actions</h2>
            <div className="mt-3 grid gap-2 text-sm">
              <Link href="/admin/products/new/" className="rounded-lg bg-brand-500 px-4 py-2.5 text-center font-semibold text-white hover:bg-brand-600">Add a product</Link>
              <Link href="/admin/import/" className="rounded-lg border border-line px-4 py-2.5 text-center font-semibold hover:bg-brand-50">Import CSV / Excel</Link>
            </div>
          </div>}
          {lowStock.length > 0 && (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="font-semibold"><Link href="/admin/inventory/" className="hover:underline">Running low</Link></h2>
              <ul className="mt-2 space-y-1 text-sm">
                {lowStock.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <Link href={`/admin/products/${p.id}/`} className="truncate hover:underline">{p.name}</Link>
                    <span className="font-semibold text-amber-600">{p.stock} left</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {can(me.role, "catalog") && <CatalogActions empty={products.length === 0} />}
        </section>
      </div>
    </div>
  );
}
