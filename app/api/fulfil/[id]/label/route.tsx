import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { barcodePng } from "@/lib/barcode";
import { labelLink, poNumber, tokenFor } from "@/lib/fulfil";
import { getOrder } from "@/lib/orders";

// The parcel label as a picture (10 × 15 cm proportions): sent to the supplier on WhatsApp so it can be printed
// from the phone. Same content as the printed label: PO number, barcode, QR, items with selling prices, cash to collect.
// No customer name, address or phone, and no cost.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (req.nextUrl.searchParams.get("t") !== tokenFor(id, "s")) return new Response("Not found", { status: 404 });
  const o = await getOrder(id);
  if (!o) return new Response("Not found", { status: 404 });
  const po = poNumber(o.id);
  const [bar, qr] = await Promise.all([barcodePng(po, "code128", { height: 18, scale: 4 }), barcodePng(labelLink(o.id), "qrcode", { scale: 8 })]);
  const lines = o.lines.filter((l) => l.productId !== "superprime");
  const items = lines.reduce((s, l) => s + l.qty, 0);
  const cod = o.paymentMethod === "cod" && o.total > 0;
  const money = (n: number) => `$${n.toFixed(2)}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "white", color: "#111", padding: 40, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "6px solid #111", paddingBottom: 16 }}>
          <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: 10 }}>SUPERYOU</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: 22 }}><span>shopsuperyou.com</span><span>+961 70 777 608</span></div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bar} width={680} height={170} alt="" />
        </div>
        <div style={{ display: "flex", justifyContent: "center", fontSize: 56, fontWeight: 900, letterSpacing: 6, marginTop: 8 }}>{po}</div>
        <div style={{ display: "flex", marginTop: 24, borderTop: "6px solid #111", paddingTop: 20, gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, fontSize: 24, gap: 6 }}>
            {lines.slice(0, 8).map((l, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ display: "flex", flex: 1 }}>{`${l.qty}× ${l.brand} ${l.name}`.slice(0, 48)}</span>
                <span style={{ fontWeight: 700 }}>{money(l.lineTotal)}</span>
              </div>
            ))}
            {lines.length > 8 && <span>+{lines.length - 8} more</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 260 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} width={250} height={250} alt="" />
            <span style={{ fontSize: 18, textAlign: "center", marginTop: 6 }}>Courier: scan with your phone for the delivery details on WhatsApp</span>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: "auto", borderTop: "6px solid #111", paddingTop: 16, justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 22, color: "#666" }}>ITEMS</span><span style={{ fontSize: 56, fontWeight: 900 }}>{items}</span></div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}><span style={{ fontSize: 22, color: "#666" }}>COLLECT FROM CUSTOMER</span><span style={{ fontSize: 72, fontWeight: 900 }}>{cod ? money(o.total) : "PAID"}</span></div>
        </div>
      </div>
    ),
    { width: 800, height: 1200, headers: { "Cache-Control": "private, max-age=300" } },
  );
}
