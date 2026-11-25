import { notFound } from "next/navigation";
import { barcodeSvg } from "@/lib/barcode";
import { labelLink, poNumber, supplierLines, tokenFor, type Role } from "@/lib/fulfil";
import { getOps } from "@/lib/ops-store";
import { getOrder, type Order } from "@/lib/orders";
import { FulfilActions, PrintButton, ScanNotice } from "./FulfilActions";

// The parcel page. Who sees what (the customer's name, address and phone are never on paper or on this page):
// - Supplier (link with r=s): 1) the PURCHASE ORDER for them (products, SKUs, their cost, total due) and
//   2) the PARCEL LABEL for the courier (PO number, barcode, QR, items with selling prices, cash to collect).
// - Courier (link with r=c): Picked up / Delivered with a photo.
// - Anyone scanning the label's QR: the delivery details are sent to the courier's WhatsApp only.
export const metadata = { title: "SuperYou parcel", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const money = (n: number) => `$${n.toFixed(2)}`;

export default async function Parcel({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; r?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const sample = id === "SAMPLE";
  if (sample) await (await import("@/lib/admin-auth")).requireAdmin("orders");
  const role: Role | "public" = (sp.r === "s" || sp.r === "c") && (sample || sp.t === tokenFor(id, sp.r as Role)) ? (sp.r as Role) : "public";
  const o = sample ? sampleOrder() : await getOrder(id);
  if (!o) notFound();
  const po = poNumber(o.id);
  const f = (await getOps()).fulfil;
  const stage = o.fulfil?.stage ?? "sent";
  const items = o.lines.filter((l) => l.productId !== "superprime").reduce((s, l) => s + l.qty, 0);
  const cod = o.paymentMethod === "cod" && o.total > 0;
  const steps: [string, string | undefined][] = [["Sent to supplier", o.fulfil?.sentAt], ["Ready for pickup", o.fulfil?.readyAt], ["Picked up", o.fulfil?.pickedAt], ["Delivered", o.fulfil?.deliveredAt]];
  const Steps = () => (
    <ol className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px] print:hidden">
      {steps.map(([l, at]) => (
        <li key={l} className={`rounded-lg px-1 py-2 ${at ? "bg-[#e6f4ee] font-semibold text-[#046c4e]" : "bg-[#f2f2f2] text-muted"}`}>{at ? "✓ " : ""}{l}{at && <span className="block font-normal">{new Date(at).toLocaleString("en-GB", { timeZone: "Asia/Beirut", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}</li>
      ))}
    </ol>
  );

  // Scanned label: details go to the courier's WhatsApp, nothing private here.
  if (role === "public")
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-xl font-black tracking-[0.2em]">SUPERYOU</p>
        <h1 className="mt-4 text-2xl font-bold">Parcel {po}</h1>
        <p className="mt-1 text-sm text-muted">{items} item{items === 1 ? "" : "s"} · {cod ? `collect ${money(o.total)}` : "paid"}</p>
        {sample ? <Sample /> : <ScanNotice id={o.id} />}
      </main>
    );

  if (role === "c")
    return (
      <main className="mx-auto max-w-xl px-4 py-6">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d13f74]">For {f.courierName || "the courier"}</p>
        <h1 className="text-2xl font-bold">Parcel {po}</h1>
        <Steps />
        <section className="mt-5 grid grid-cols-2 rounded-xl border-2 border-ink p-4 text-sm">
          <p><span className="block text-[10px] font-bold uppercase tracking-widest text-muted">Items</span><b className="text-lg">{items}</b></p>
          <p className="text-right"><span className="block text-[10px] font-bold uppercase tracking-widest text-muted">Collect</span><b className="text-lg">{cod ? `${money(o.total)} cash` : "Nothing (paid)"}</b></p>
          <p className="col-span-2 mt-2 text-xs text-muted">The customer&apos;s name, address and phone are in your WhatsApp. Pick up at: {f.supplierName}{f.supplierAddress ? `, ${f.supplierAddress}` : ""}</p>
        </section>
        {sample ? <Sample /> : <FulfilActions id={o.id} t={sp.t!} role="c" stage={stage} pod={o.fulfil?.pod} po={po} />}
      </main>
    );

  // Supplier: purchase order + parcel label.
  const lines = sample
    ? [{ name: "Effaclar Duo+M", brand: "La Roche-Posay", qty: 1, sku: "NEO-48213377", variant: "40 ml", cost: 14.2, price: 21 }, { name: "Hyalu B5 Serum", brand: "La Roche-Posay", qty: 1, sku: "NEO-48190021", variant: "30 ml", cost: 27.5, price: 39 }]
    : await supplierLines(o, f.source);
  const due = lines.reduce((s, l) => s + l.cost, 0);
  const [bar, qr] = await Promise.all([barcodeSvg(po, "code128", { height: 16, scale: 3 }), barcodeSvg(labelLink(o.id), "qrcode", { scale: 4 })]);
  const date = new Date(o.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Beirut", day: "numeric", month: "long", year: "numeric" });
  return (
    <main className="mx-auto max-w-xl px-4 py-6 print:p-0">
      <style>{`@media print {
        body[data-print="po"] #label, body[data-print="label"] #po, .print\\:hidden { display: none !important; }
        body[data-print="label"] main > :not(#label) { display: none !important; }
        body[data-print="po"] main > :not(#po) { display: none !important; }
        body[data-print="label"] #label { border: 0 !important; margin: 0 !important; }
        @page { margin: 6mm; }
      }`}</style>
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d13f74] print:hidden">For {f.supplierName}</p>
      <h1 className="text-2xl font-bold print:hidden">Purchase order {po}</h1>
      <Steps />

      {/* 1. Purchase order: for the supplier (their cost, what we owe). Stays with the supplier. */}
      <section id="po" className="mt-5 rounded-xl border border-line bg-white p-4 text-sm">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-2">
          <div><p className="text-lg font-black tracking-[0.15em]">SUPERYOU</p><p className="text-xs text-muted">Purchase order</p></div>
          <div className="text-right"><p className="font-mono text-lg font-bold">{po}</p><p className="text-xs text-muted">{date}</p></div>
        </div>
        <p className="mt-2 text-xs">To: <b>{f.supplierName}</b>{f.supplierAddress ? `, ${f.supplierAddress}` : ""}</p>
        <table className="mt-3 w-full">
          <thead className="text-left text-xs text-muted"><tr><th className="py-1">Qty</th><th>Product</th><th>SKU</th><th className="text-right">Cost</th></tr></thead>
          <tbody className="divide-y divide-line">
            {lines.map((l, i) => <tr key={i}><td className="py-1.5 font-bold">{l.qty}</td><td>{l.brand} {l.name}{l.variant ? ` · ${l.variant}` : ""}</td><td className="font-mono text-xs">{l.sku}</td><td className="text-right">{money(l.cost)}</td></tr>)}
          </tbody>
          <tfoot><tr className="border-t-2 border-ink font-bold"><td colSpan={3} className="py-2">Total due to {f.supplierName} on delivery</td><td className="text-right">{money(due)}</td></tr></tfoot>
        </table>
        <p className="mt-2 text-xs text-muted">Pack these items with the parcel label below; tap Ready for pickup when packed.</p>
      </section>
      <PrintButton target="po" label="🖨️ Print purchase order" />

      {/* 2. Parcel label: goes on the box for the courier. Selling prices only; no cost, no customer details. */}
      <section id="label" className="mt-6 rounded-xl border-2 border-ink bg-white p-4 text-ink">
        <div className="flex items-center justify-between border-b-2 border-ink pb-2">
          <p className="text-xl font-black tracking-[0.2em]">SUPERYOU</p>
          <p className="text-right text-[11px] leading-tight">shopsuperyou.com<br />+961 70 777 608</p>
        </div>
        <div className="mt-2 flex justify-center [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-[320px]" dangerouslySetInnerHTML={{ __html: bar }} />
        <p className="mt-1 text-center font-mono text-2xl font-black tracking-[0.15em]">{po}</p>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-3 border-t-2 border-ink pt-2">
          <table className="w-full self-start text-xs">
            <tbody>
              {o.lines.filter((l) => l.productId !== "superprime").map((l, i) => <tr key={i}><td className="pe-1 align-top font-bold">{l.qty}×</td><td className="align-top">{l.brand} {l.name}</td><td className="ps-1 text-right align-top">{money(l.lineTotal)}</td></tr>)}
            </tbody>
          </table>
          <div className="w-28 text-center [&_svg]:h-auto [&_svg]:w-full">
            <div dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="mt-1 text-[9px] font-semibold leading-tight">Courier: scan with your phone to get the delivery details on WhatsApp</p>
          </div>
        </div>
        <div className="mt-2 flex items-end justify-between border-t-2 border-ink pt-2">
          <p className="text-sm"><span className="block text-[10px] font-bold uppercase tracking-widest text-muted">Items</span><b className="text-lg">{items}</b></p>
          <p className="text-right"><span className="block text-[10px] font-bold uppercase tracking-widest text-muted">Collect from customer</span><b className="text-2xl">{cod ? money(o.total) : "PAID"}</b></p>
        </div>
      </section>
      <PrintButton target="label" label="🖨️ Print parcel label (for the courier)" />

      {sample ? <Sample /> : <FulfilActions id={o.id} t={sp.t!} role="s" stage={stage} po={po} />}
    </main>
  );
}

const Sample = () => <p className="mt-5 rounded-xl bg-[#fff4e5] p-3 text-center text-sm print:hidden">Sample only: on a real order the buttons here move the order along.</p>;

function sampleOrder() {
  return {
    id: "SUP-SAMPLE1", accessToken: "", createdAt: new Date().toISOString(), status: "pending_cod", paymentMethod: "cod", lines: [{ productId: "x", name: "Effaclar Duo+M", brand: "La Roche-Posay", unitPrice: 21, qty: 1, lineTotal: 21 }, { productId: "y", name: "Hyalu B5 Serum", brand: "La Roche-Posay", unitPrice: 39, qty: 1, lineTotal: 39 }],
    subtotal: 60, delivery: 3, total: 63, currency: "USD",
    customer: { firstName: "Rana", lastName: "Khoury", phone: "+961 70 123 456", email: "", address: "Building 12", city: "Jounieh", zone: "Keserwan", notes: "" },
    fulfil: { stage: "sent", sentAt: new Date().toISOString() },
  } as unknown as Order;
}
