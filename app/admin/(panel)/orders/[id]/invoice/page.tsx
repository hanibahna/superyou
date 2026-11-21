import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/PrintButton";
import { requireAdmin } from "@/lib/admin-auth";
import { money } from "@/lib/format";
import { getOps } from "@/lib/ops-store";
import { getOrder, refunded } from "@/lib/orders";
import { getSettings } from "@/lib/site-store";

const PAY: Record<string, string> = { cod: "Cash on delivery", card: "Card", whish: "Whish" };

export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("orders");
  const [o, ops, s] = await Promise.all([getOrder((await params).id), getOps(), getSettings()]);
  if (!o) notFound();
  const c = o.customer;
  const back = refunded(o);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end gap-2 print:hidden"><PrintButton /></div>
      <article className="rounded-xl bg-white p-10 text-sm shadow-sm print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/superyou-logo.svg" alt={s.store.name} className="h-6 w-auto" />
            <p className="mt-3 font-semibold">{ops.invoice.businessName || s.store.name}</p>
            {s.store.address && <p className="text-muted">{s.store.address}</p>}
            <p className="text-muted">{s.store.phone}{s.store.email ? ` · ${s.store.email}` : ""}</p>
            {ops.invoice.taxId && <p className="text-muted">Tax / MOF no. {ops.invoice.taxId}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold uppercase tracking-wide">{ops.invoice.title || "Invoice"}</p>
            <p className="mt-2">No. <b>{o.id}</b></p>
            <p className="text-muted">{new Date(o.createdAt).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "Asia/Beirut" })}</p>
            <p className="text-muted">{PAY[o.paymentMethod] ?? o.paymentMethod}</p>
          </div>
        </header>
        <section className="grid gap-6 border-b border-line py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Billed to</p>
            <p className="mt-1 font-semibold">{c.firstName} {c.lastName}</p>
            <p>{c.phone}</p>
            {c.email && <p>{c.email}</p>}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Delivered to</p>
            <p className="mt-1">{c.address}</p>
            <p>{c.city}, {c.zone}</p>
          </div>
        </section>
        <table className="mt-6 w-full">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="pb-2">Item</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Unit price</th><th className="pb-2 text-right">Amount</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {o.lines.map((l) => (
              <tr key={l.productId + (l.gift ? "g" : "")}><td className="py-2">{l.brand} {l.name}</td><td className="py-2 text-right">{l.qty}</td><td className="py-2 text-right">{money(l.unitPrice)}</td><td className="py-2 text-right">{money(l.lineTotal)}</td></tr>
            ))}
          </tbody>
        </table>
        <dl className="ms-auto mt-4 w-full max-w-xs space-y-1">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
          {o.discounts?.map((d) => <div key={d.name} className="flex justify-between"><dt>{d.name}</dt><dd>−{money(d.amount)}</dd></div>)}
          <div className="flex justify-between"><dt>Delivery</dt><dd>{o.delivery ? money(o.delivery) : "Free"}</dd></div>
          {o.giftCard && <div className="flex justify-between"><dt>Gift card</dt><dd>−{money(o.giftCard.amount)}</dd></div>}
          <div className="flex justify-between border-t border-line pt-1 text-base font-bold"><dt>Total ({o.currency})</dt><dd>{money(o.total)}</dd></div>
          {back > 0 && <div className="flex justify-between text-sale"><dt>Refunded</dt><dd>−{money(back)}</dd></div>}
        </dl>
        {ops.invoice.footer && <p className="mt-10 border-t border-line pt-4 text-center text-xs text-muted">{ops.invoice.footer}</p>}
      </article>
    </div>
  );
}
