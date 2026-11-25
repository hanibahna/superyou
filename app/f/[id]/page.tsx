import { notFound } from "next/navigation";
import { barcodeSvg } from "@/lib/barcode";
import { linkFor, supplierLines, tokenFor, type Role } from "@/lib/fulfil";
import { getOps } from "@/lib/ops-store";
import { getOrder } from "@/lib/orders";
import { FulfilActions } from "./FulfilActions";

// The page the label link / QR code opens. Supplier (r=s): label to print + pick list + "Ready for pickup".
// Courier (r=c): who to deliver to + "Picked up" + "Delivered" with a photo. No login: the link carries a key.
export const metadata = { title: "SuperYou parcel", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const money = (n: number) => `$${n.toFixed(2)}`;

export default async function Parcel({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; r?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const role = sp.r as Role;
  // /f/SAMPLE/?r=s or ?r=c: a sample parcel for the team to preview (admins only).
  const sample = id === "SAMPLE";
  if (sample) await (await import("@/lib/admin-auth")).requireAdmin("orders");
  else if ((role !== "s" && role !== "c") || sp.t !== tokenFor(id, role)) notFound();
  const o = sample ? sampleOrder() : await getOrder(id);
  if (!o) notFound();
  const f = (await getOps()).fulfil;
  const lines = sample ? [{ name: "Effaclar Duo+M", brand: "La Roche-Posay", qty: 1, sku: "NEO-48213377", variant: "40 ml", cost: 14.2 }, { name: "Hyalu B5 Serum", brand: "La Roche-Posay", qty: 1, sku: "NEO-48190021", variant: "30 ml", cost: 27.5 }] : await supplierLines(o, f.source);
  const items = o.lines.filter((l) => l.productId !== "superprime").reduce((s, l) => s + l.qty, 0);
  const cod = o.paymentMethod === "cod" && o.total > 0;
  const [bar, qr] = await Promise.all([barcodeSvg(o.id, "code128", { height: 16, scale: 3 }), barcodeSvg(linkFor(o.id, "c"), "qrcode", { scale: 4 })]);
  const stage = o.fulfil?.stage ?? "sent";
  const steps: [string, string | undefined][] = [["Sent to supplier", o.fulfil?.sentAt], ["Ready for pickup", o.fulfil?.readyAt], ["Picked up", o.fulfil?.pickedAt], ["Delivered", o.fulfil?.deliveredAt]];

  return (
    <main className="mx-auto max-w-xl px-4 py-6 print:p-0">
      <style>{`@media print { @page { size: 100mm 150mm; margin: 4mm; } body * { visibility: hidden; } #label, #label * { visibility: visible; } #label { position: absolute; inset: 0; border: 0 !important; box-shadow: none !important; } }`}</style>
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d13f74] print:hidden">{role === "s" ? `For ${f.supplierName}` : `For ${f.courierName || "the courier"}`}</p>
      <h1 className="text-2xl font-bold print:hidden">Order {o.id}</h1>

      <ol className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px] print:hidden">
        {steps.map(([l, at]) => (
          <li key={l} className={`rounded-lg px-1 py-2 ${at ? "bg-[#e6f4ee] font-semibold text-[#046c4e]" : "bg-[#f2f2f2] text-muted"}`}>{at ? "✓ " : ""}{l}{at && <span className="block font-normal">{new Date(at).toLocaleString("en-GB", { timeZone: "Asia/Beirut", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}</li>
        ))}
      </ol>

      {/* The parcel label (10 × 15 cm). It never names the supplier: the customer only sees SuperYou. */}
      <section id="label" className="mt-5 rounded-xl border-2 border-ink bg-white p-4 text-ink">
        <div className="flex items-center justify-between border-b-2 border-ink pb-2">
          <p className="text-xl font-black tracking-[0.2em]">SUPERYOU</p>
          <p className="text-right text-[11px] leading-tight">shopsuperyou.com<br />+961 70 777 608</p>
        </div>
        <div className="mt-2 flex justify-center [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-[320px]" dangerouslySetInnerHTML={{ __html: bar }} />
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
          <div className="text-sm leading-snug">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Deliver to</p>
            <p className="text-base font-bold">{o.customer.firstName} {o.customer.lastName}</p>
            <p className="font-semibold" dir="ltr">{o.customer.phone}</p>
            <p>{o.customer.address}</p>
            <p className="font-semibold">{o.customer.city}, {o.customer.zone}</p>
            {o.customer.notes && <p className="mt-1 text-xs">Note: {o.customer.notes}</p>}
          </div>
          <div className="w-28 text-center [&_svg]:h-auto [&_svg]:w-full" >
            <div dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="mt-1 text-[9px] leading-tight">Courier: scan to confirm pickup &amp; delivery</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 border-t-2 border-ink pt-2 text-sm">
          <p><span className="block text-[10px] font-bold uppercase tracking-widest text-muted">Items</span><b className="text-lg">{items}</b></p>
          <p className="text-right"><span className="block text-[10px] font-bold uppercase tracking-widest text-muted">Collect</span><b className="text-lg">{cod ? money(o.total) : "PAID"}</b></p>
        </div>
      </section>

      {role === "s" && (
        <section className="mt-5 rounded-xl border border-line p-4 print:hidden">
          <h2 className="font-bold">Pick list</h2>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="py-1">Qty</th><th>Product</th><th>SKU</th></tr></thead>
            <tbody className="divide-y divide-line">
              {lines.map((l, i) => <tr key={i}><td className="py-1.5 font-bold">{l.qty}</td><td>{l.brand} {l.name}{l.variant ? ` · ${l.variant}` : ""}</td><td className="font-mono text-xs">{l.sku}</td></tr>)}
            </tbody>
          </table>
        </section>
      )}

      {role === "c" && (
        <section className="mt-5 rounded-xl border border-line p-4 text-sm print:hidden">
          <p><b>Pick up at:</b> {f.supplierName}{f.supplierAddress ? `, ${f.supplierAddress}` : ""}</p>
          <p className="mt-1"><b>Collect from the customer:</b> {cod ? `${money(o.total)} cash` : "nothing, already paid"}</p>
          <a href={`tel:${o.customer.phone.replace(/\s/g, "")}`} className="mt-3 inline-flex min-h-[44px] items-center rounded-full border border-line px-4 font-semibold" dir="ltr">📞 {o.customer.phone}</a>
        </section>
      )}

      {sample ? <p className="mt-5 rounded-xl bg-[#fff4e5] p-3 text-center text-sm print:hidden">Sample only: on a real order the buttons here move the order along.</p> : <FulfilActions id={o.id} t={sp.t!} role={role} stage={stage} pod={o.fulfil?.pod} />}
    </main>
  );
}

function sampleOrder() {
  return {
    id: "SUP-SAMPLE1", accessToken: "", createdAt: new Date().toISOString(), status: "pending_cod", paymentMethod: "cod", lines: [{ productId: "x", name: "Effaclar Duo+M", brand: "La Roche-Posay", unitPrice: 21, qty: 1, lineTotal: 21 }, { productId: "y", name: "Hyalu B5 Serum", brand: "La Roche-Posay", unitPrice: 39, qty: 1, lineTotal: 39 }],
    subtotal: 60, delivery: 3, total: 63, currency: "USD",
    customer: { firstName: "Rana", lastName: "Khoury", phone: "+961 70 123 456", email: "", address: "Building 12, 3rd floor, Main street", city: "Jounieh", zone: "Keserwan", notes: "Call before arriving" },
    fulfil: { stage: "sent", sentAt: new Date().toISOString() },
  } as unknown as import("@/lib/orders").Order;
}
