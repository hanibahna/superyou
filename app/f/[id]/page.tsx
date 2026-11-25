import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { barcodeSvg } from "@/lib/barcode";
import { courierKey, labelLink, poNumber, supplierLines, tokenFor, type Role } from "@/lib/fulfil";
import { getOps } from "@/lib/ops-store";
import { getOrder, type Order } from "@/lib/orders";
import { FulfilActions } from "./FulfilActions";

// The parcel page. Who sees what:
// - Supplier (link with r=s): tracking label to print (purchase order number + barcode + QR, NO customer details) and the pick list.
// - Courier (link with r=c, or a phone that opened one before): the customer's name, address, phone and cash to collect,
//   with Picked up / Delivered (photo). Scanning the label's QR on the courier's phone opens this view.
// - Anyone else scanning the label: only the purchase order number.
export const metadata = { title: "SuperYou parcel", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const money = (n: number) => `$${n.toFixed(2)}`;

export default async function Parcel({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; r?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const sample = id === "SAMPLE";
  if (sample) await (await import("@/lib/admin-auth")).requireAdmin("orders");
  const linkRole = (sp.r === "s" || sp.r === "c") && (sample || sp.t === tokenFor(id, sp.r as Role)) ? (sp.r as Role) : null;
  const device = (await cookies()).get("sy_courier")?.value === courierKey();
  const role: Role | "public" = linkRole ?? (device ? "c" : "public");
  const o = sample ? sampleOrder() : await getOrder(id);
  if (!o) notFound();
  const po = poNumber(o.id);
  const f = (await getOps()).fulfil;
  const stage = o.fulfil?.stage ?? "sent";
  const steps: [string, string | undefined][] = [["Sent to supplier", o.fulfil?.sentAt], ["Ready for pickup", o.fulfil?.readyAt], ["Picked up", o.fulfil?.pickedAt], ["Delivered", o.fulfil?.deliveredAt]];
  const Steps = () => (
    <ol className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px] print:hidden">
      {steps.map(([l, at]) => (
        <li key={l} className={`rounded-lg px-1 py-2 ${at ? "bg-[#e6f4ee] font-semibold text-[#046c4e]" : "bg-[#f2f2f2] text-muted"}`}>{at ? "✓ " : ""}{l}{at && <span className="block font-normal">{new Date(at).toLocaleString("en-GB", { timeZone: "Asia/Beirut", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}</li>
      ))}
    </ol>
  );

  if (role === "public")
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-xl font-black tracking-[0.2em]">SUPERYOU</p>
        <h1 className="mt-4 text-2xl font-bold">Parcel {po}</h1>
        <p className="mt-2 text-sm text-muted">Courier? Open the pickup link we sent you on WhatsApp or email once on this phone, then scan the label again.</p>
      </main>
    );

  const items = o.lines.filter((l) => l.productId !== "superprime").reduce((s, l) => s + l.qty, 0);
  const cod = o.paymentMethod === "cod" && o.total > 0;

  if (role === "c")
    return (
      <main className="mx-auto max-w-xl px-4 py-6">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d13f74]">For {f.courierName || "the courier"}</p>
        <h1 className="text-2xl font-bold">Parcel {po}</h1>
        <Steps />
        <section className="mt-5 rounded-xl border-2 border-ink p-4 text-sm leading-relaxed">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Deliver to</p>
          <p className="text-lg font-bold">{o.customer.firstName} {o.customer.lastName}</p>
          <p>{o.customer.address}</p>
          <p className="font-semibold">{o.customer.city}, {o.customer.zone}</p>
          {o.customer.notes && <p className="mt-1 rounded bg-amber-50 p-2 text-xs">Note: {o.customer.notes}</p>}
          {o.customer.lat && o.customer.lng && <a href={`https://www.google.com/maps?q=${o.customer.lat},${o.customer.lng}`} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold underline">📍 Open the pin in Google Maps</a>}
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`tel:${o.customer.phone.replace(/\s/g, "")}`} className="inline-flex min-h-[44px] items-center rounded-full border border-line px-4 font-semibold" dir="ltr">📞 {o.customer.phone}</a>
            <a href={`https://wa.me/${o.customer.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center rounded-full bg-[#25D366] px-4 font-semibold text-white">WhatsApp</a>
          </div>
          <div className="mt-3 grid grid-cols-2 border-t border-line pt-2">
            <p><span className="block text-[10px] font-bold uppercase tracking-widest text-muted">Items</span><b className="text-lg">{items}</b></p>
            <p className="text-right"><span className="block text-[10px] font-bold uppercase tracking-widest text-muted">Collect</span><b className="text-lg">{cod ? `${money(o.total)} cash` : "Nothing (paid)"}</b></p>
          </div>
          <p className="mt-2 text-xs text-muted">Pick up at: {f.supplierName}{f.supplierAddress ? `, ${f.supplierAddress}` : ""}</p>
        </section>
        {sample ? <Sample /> : <FulfilActions id={o.id} t={linkRole ? sp.t! : ""} role="c" stage={stage} pod={o.fulfil?.pod} po={po} remember={!!linkRole} />}
      </main>
    );

  // Supplier: tracking label (no customer details) + pick list.
  const lines = sample ? [{ name: "Effaclar Duo+M", brand: "La Roche-Posay", qty: 1, sku: "NEO-48213377", variant: "40 ml", cost: 14.2 }, { name: "Hyalu B5 Serum", brand: "La Roche-Posay", qty: 1, sku: "NEO-48190021", variant: "30 ml", cost: 27.5 }] : await supplierLines(o, f.source);
  const [bar, qr] = await Promise.all([barcodeSvg(po, "code128", { height: 16, scale: 3 }), barcodeSvg(labelLink(o.id), "qrcode", { scale: 4 })]);
  return (
    <main className="mx-auto max-w-xl px-4 py-6 print:p-0">
      <style>{`@media print { @page { size: 100mm 150mm; margin: 4mm; } body * { visibility: hidden; } #label, #label * { visibility: visible; } #label { position: absolute; inset: 0; border: 0 !important; } }`}</style>
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d13f74] print:hidden">For {f.supplierName}</p>
      <h1 className="text-2xl font-bold print:hidden">Purchase order {po}</h1>
      <Steps />

      <section id="label" className="mt-5 rounded-xl border-2 border-ink bg-white p-4 text-ink">
        <div className="flex items-center justify-between border-b-2 border-ink pb-2">
          <p className="text-xl font-black tracking-[0.2em]">SUPERYOU</p>
          <p className="text-right text-[11px] leading-tight">shopsuperyou.com<br />+961 70 777 608</p>
        </div>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted">Tracking · purchase order</p>
        <div className="mt-1 flex justify-center [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-[320px]" dangerouslySetInnerHTML={{ __html: bar }} />
        <p className="mt-1 text-center font-mono text-2xl font-black tracking-[0.2em]">{po}</p>
        <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 border-t-2 border-ink pt-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Items</p>
            <p className="text-3xl font-black">{items}</p>
            <p className="mt-2 text-xs leading-snug">Courier: scan the QR to confirm pickup. Delivery details are on your phone.</p>
          </div>
          <div className="w-28 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-line p-4 print:hidden">
        <h2 className="font-bold">Pick list · {po}</h2>
        <table className="mt-2 w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="py-1">Qty</th><th>Product</th><th>SKU</th></tr></thead>
          <tbody className="divide-y divide-line">
            {lines.map((l, i) => <tr key={i}><td className="py-1.5 font-bold">{l.qty}</td><td>{l.brand} {l.name}{l.variant ? ` · ${l.variant}` : ""}</td><td className="font-mono text-xs">{l.sku}</td></tr>)}
          </tbody>
        </table>
      </section>

      {sample ? <Sample /> : <FulfilActions id={o.id} t={sp.t!} role="s" stage={stage} po={po} />}
    </main>
  );
}

const Sample = () => <p className="mt-5 rounded-xl bg-[#fff4e5] p-3 text-center text-sm print:hidden">Sample only: on a real order the buttons here move the order along.</p>;

function sampleOrder() {
  return {
    id: "SUP-SAMPLE1", accessToken: "", createdAt: new Date().toISOString(), status: "pending_cod", paymentMethod: "cod", lines: [{ productId: "x", name: "Effaclar Duo+M", brand: "La Roche-Posay", unitPrice: 21, qty: 1, lineTotal: 21 }, { productId: "y", name: "Hyalu B5 Serum", brand: "La Roche-Posay", unitPrice: 39, qty: 1, lineTotal: 39 }],
    subtotal: 60, delivery: 3, total: 63, currency: "USD",
    customer: { firstName: "Rana", lastName: "Khoury", phone: "+961 70 123 456", email: "", address: "Building 12, 3rd floor, Main street", city: "Jounieh", zone: "Keserwan", notes: "Call before arriving" },
    fulfil: { stage: "sent", sentAt: new Date().toISOString() },
  } as unknown as Order;
}
