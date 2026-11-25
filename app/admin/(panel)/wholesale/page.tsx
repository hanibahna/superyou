import { requireAdmin } from "@/lib/admin-auth";
import { listWholesale } from "@/lib/wholesale";
import { WholesaleStatus } from "@/components/admin/WholesaleStatus";

// Wholesale enquiries from the /wholesale/ form.
export default async function WholesaleAdmin() {
  await requireAdmin("orders");
  const list = await listWholesale();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Wholesale enquiries <span className="text-base font-normal text-muted">({list.length})</span></h1>
      <p className="mt-1 text-sm text-muted">From shopsuperyou.com/wholesale/. Each one is also emailed to the orders inbox.</p>
      <div className="mt-4 space-y-3">
        {list.map((w) => (
          <div key={w.id} className="rounded-xl bg-white p-4 text-sm shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{w.business} <span className="font-normal text-muted">· {w.type || "—"} · {w.city || "—"}</span></p>
                <p>{w.contact} · <a href={`tel:${w.phone}`} className="text-brand-700">{w.phone}</a> · <a href={`https://wa.me/${w.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-brand-700">WhatsApp</a>{w.email && <> · <a href={`mailto:${w.email}`} className="text-brand-700">{w.email}</a></>}</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={`/admin/bulk-buyers/?${new URLSearchParams({ phone: w.phone, name: w.contact, company: w.business, enquiry: w.id })}`} className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">Approve as bulk buyer</a>
                <WholesaleStatus id={w.id} status={w.status} />
              </div>
            </div>
            <p className="mt-2 text-muted">Volume: {w.volume || "—"} · Needs: {w.categories.join(", ") || "—"}{w.brands ? ` · Brands: ${w.brands}` : ""}</p>
            {w.message && <p className="mt-2 whitespace-pre-line">{w.message}</p>}
            <p className="mt-2 text-xs text-muted">{w.id} · {new Date(w.at).toLocaleString("en-GB", { timeZone: "Asia/Beirut" })}</p>
          </div>
        ))}
        {!list.length && <p className="rounded-xl bg-white p-8 text-center text-muted">No enquiries yet.</p>}
      </div>
    </div>
  );
}
