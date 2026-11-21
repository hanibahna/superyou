import { type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { orderValue, refunded, statusLabels } from "@/lib/orders";
import { toCsv } from "@/lib/product-input";
import { ordersBetween } from "@/lib/sales";

// Orders as a spreadsheet (for the accountant).
export async function GET(req: NextRequest) {
  const denied = await adminGuard("sales");
  if (denied) return denied;
  const days = Math.min(3650, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30));
  const now = Date.now();
  const orders = await ordersBetween(now - days * 864e5, now);
  const rows = [
    ["Order", "Date (Beirut)", "Status", "Customer", "Phone", "Area", "Payment", "Items", "Subtotal", "Discounts", "Delivery", "Gift card", "Paid", "Refunded", "Net", "Courier", "Tracking"],
    ...orders.map((o) => [
      o.id, new Date(o.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Beirut" }), statusLabels[o.status], `${o.customer.firstName} ${o.customer.lastName}`, o.customer.phone, o.customer.zone,
      o.paymentMethod, o.lines.map((l) => `${l.qty}x ${l.brand} ${l.name}`).join("; "), o.subtotal.toFixed(2), (o.discount ?? 0).toFixed(2), o.delivery.toFixed(2),
      (o.giftCard?.amount ?? 0).toFixed(2), o.total.toFixed(2), refunded(o).toFixed(2), (orderValue(o) - refunded(o)).toFixed(2), o.shipment?.courierName ?? "", o.shipment?.tracking ?? "",
    ]),
  ];
  return new Response(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="superyou-orders-${days}d.csv"` } });
}
