import { requireAdmin } from "@/lib/admin-auth";
import { listBulkBuyers } from "@/lib/bulk";
import { getGrowth } from "@/lib/growth-store";
import { bulkPct } from "@/lib/growth";
import { BulkBuyersEditor } from "@/components/admin/BulkBuyersEditor";

// Companies and people approved for their own bulk / business price.
export default async function BulkBuyers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin("orders");
  const [list, g, sp] = await Promise.all([listBulkBuyers(), getGrowth(), searchParams]);
  return (
    <div>
      <h1 className="text-2xl font-semibold">Bulk buyers <span className="text-base font-normal text-muted">({list.filter((b) => b.active).length} active)</span></h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Companies or people you approve for a business price. They&apos;re recognised by their mobile number at checkout (website and app) and get their own % on every product,
        from their minimum quantity, with their own daily cap. Prices never go below cost + your minimum margin; SuperPrice and subscribed items are excluded.
        Everyone else gets the public bulk buy: {g.bulk.enabled ? `${bulkPct(g)}% off 2–${g.bulk.maxUnits} items a day` : "off"}.
      </p>
      <BulkBuyersEditor initial={list} prefill={{ phone: sp.phone ?? "", name: sp.name ?? "", company: sp.company ?? "", enquiry: sp.enquiry ?? "" }} defaultPct={bulkPct(g)} />
    </div>
  );
}
