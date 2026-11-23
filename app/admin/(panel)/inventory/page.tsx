import { fullName } from "@/lib/data/catalog";
import Link from "next/link";
import { InventoryTable } from "@/components/admin/InventoryTable";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllProducts } from "@/lib/catalog";
import { stockLog } from "@/lib/inventory";
import { getOps } from "@/lib/ops-store";

const TABS = [["low", "Running low"], ["out", "Sold out"], ["tracked", "All counted"], ["untracked", "Not counted"]] as const;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ show?: string; q?: string }> }) {
  await requireAdmin("inventory");
  const sp = await searchParams;
  const [products, ops, log] = await Promise.all([getAllProducts(), getOps(), stockLog(60)]);
  const lowAt = ops.stock.lowAt;
  const tracked = products.filter((p) => p.stock !== undefined);
  const show = (sp.show ?? (tracked.length ? "low" : "untracked")) as (typeof TABS)[number][0];
  const q = (sp.q ?? "").trim().toLowerCase();
  let list =
    show === "low" ? tracked.filter((p) => p.stock! > 0 && p.stock! <= lowAt)
    : show === "out" ? tracked.filter((p) => p.stock === 0)
    : show === "tracked" ? tracked
    : products.filter((p) => p.stock === undefined);
  if (q) list = list.filter((p) => `${fullName(p.brand, p.name)} ${p.sku} ${p.barcode ?? ""}`.toLowerCase().includes(q));
  list.sort((a, b) => (a.stock ?? 1e9) - (b.stock ?? 1e9) || a.name.localeCompare(b.name));
  const counts = { low: tracked.filter((p) => p.stock! > 0 && p.stock! <= lowAt).length, out: tracked.filter((p) => p.stock === 0).length, tracked: tracked.length, untracked: products.length - tracked.length };
  const rows = list.slice(0, 300).map((p) => ({ id: p.id, name: p.name, brand: p.brand, variant: p.variant, sku: p.sku, stock: p.stock, image: p.image, status: p.status }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="text-sm text-muted">Counts go down when an order is placed and back up when it&apos;s cancelled. A product with no count is &quot;not counted&quot; and never sells out on its own. Low-stock alert at {lowAt} or fewer (change in <Link href="/admin/operations/" className="underline">Operations</Link>).</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {TABS.map(([k, l]) => <Link key={k} href={`/admin/inventory/?show=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`rounded-full px-4 py-1.5 ${show === k ? "bg-ink text-white" : "bg-white"}`}>{l} <span className="opacity-60">{counts[k]}</span></Link>)}
        <form className="ms-auto" action="/admin/inventory/">
          <input type="hidden" name="show" value={show} />
          <input name="q" defaultValue={sp.q} placeholder="Search name, brand, SKU, barcode" className="w-64 rounded-lg border border-line bg-white px-3 py-1.5" />
        </form>
      </div>
      <InventoryTable rows={rows} lowAt={lowAt} more={list.length - rows.length} />
      <p className="text-xs text-muted">Counting thousands of products at once? Download the catalog in <Link href="/admin/import/" className="underline">Import / export</Link>, fill in the Stock column and import it back.</p>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Recent stock changes</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {log.map((m) => (
              <tr key={`${m.at}${m.productId}`}>
                <td className="py-1.5 whitespace-nowrap text-muted">{new Date(m.at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Beirut" })}</td>
                <td className="py-1.5"><Link href={`/admin/products/${m.productId}/`} className="hover:underline">{m.name}</Link></td>
                <td className="py-1.5 whitespace-nowrap">{m.from} → <b>{m.to}</b> <span className={m.to > m.from ? "text-brand-600" : "text-sale"}>({m.to > m.from ? "+" : ""}{m.to - m.from})</span></td>
                <td className="py-1.5 text-muted">{m.reason}</td>
                <td className="py-1.5 text-muted">{m.by}</td>
              </tr>
            ))}
            {!log.length && <tr><td className="py-6 text-center text-muted">No changes yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
