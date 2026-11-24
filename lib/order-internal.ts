import "server-only";

// Internal order sheet: what each line costs us, where it comes from (distributor), delivery cost and
// profit. Sent to the orders mailbox and kept on the server for the admin; never in the customer's order.
import { db } from "@/lib/db";
import { getIndex } from "@/lib/catalog";
import { getGrowth } from "@/lib/growth-store";
import { getSettings, getSourcing } from "@/lib/site-store";
import { landed } from "@/lib/sourcing";
import type { Order } from "@/lib/orders";

export const ORDERS_INBOX = process.env.ORDERS_EMAIL || "order@shopsuperyou.com";

export type InternalLine = { name: string; brand: string; qty: number; unitPrice: number; lineTotal: number; unitCost: number; costEstimated: boolean; source: string; supplier: string; sku: string; margin: number };
export type InternalSheet = {
  orderId: string; at: string; customer: string; phone: string; zone: string; payment: string;
  lines: InternalLine[]; goods: number; discount: number; deliveryCharged: number; courierCost: number; deliveryPaidBy: "client" | "us";
  primeFee: number; revenue: number; cost: number; profit: number; marginPct: number; estimated: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function buildSheet(o: Order): Promise<InternalSheet> {
  const [idx, sourcing, growth, settings] = await Promise.all([getIndex(), getSourcing(), getGrowth(), getSettings()]);
  const assume = growth.priceMatch.assumeMarginPct || 30;
  const lines: InternalLine[] = o.lines
    .filter((l) => l.productId !== "superprime")
    .map((l) => {
      const p = idx.byId.get(l.productId);
      const src = (p?.source ?? "manual").toLowerCase();
      const rule = sourcing.sources.find((x) => x.source.toLowerCase() === src);
      const known = !!p?.cost && p.cost > 0;
      // Cost: supplier price on file (imports at landed cost), else estimated from the assumed margin.
      const unitCost = known ? (rule?.origin === "international" && rule.pricing ? landed(p!.cost!, rule.pricing).landed : p!.cost!) : l.gift ? (p?.price ?? 0) * (1 - assume / 100) : l.unitPrice * (1 - assume / 100);
      const lineCost = unitCost * l.qty;
      return {
        name: l.name, brand: l.brand, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal, unitCost: r2(unitCost), costEstimated: !known,
        source: src, supplier: rule?.label ?? (src === "manual" ? "Own stock / manual" : src), sku: p?.sku ?? l.productId,
        margin: l.lineTotal > 0 ? Math.round(((l.lineTotal - lineCost) / l.lineTotal) * 1000) / 10 : -100,
      };
    });
  const goods = r2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const primeFee = r2(o.lines.filter((l) => l.productId === "superprime").reduce((s, l) => s + l.lineTotal, 0));
  // Courier: we pay the courier on every order; the client pays the delivery fee unless delivery is free.
  const courierCost = settings.delivery.fee;
  const revenue = r2(goods - (o.discount ?? 0) + (o.delivery ?? 0) + primeFee);
  const cost = r2(lines.reduce((s, l) => s + l.unitCost * l.qty, 0) + courierCost);
  const profit = r2(revenue - cost);
  return {
    orderId: o.id, at: o.createdAt, customer: `${o.customer.firstName} ${o.customer.lastName}`, phone: o.customer.phone, zone: `${o.customer.zone}, ${o.customer.city}`,
    payment: o.paymentMethod === "cod" ? "Cash on delivery" : o.paymentMethod, lines, goods, discount: o.discount ?? 0, deliveryCharged: o.delivery ?? 0, courierCost,
    deliveryPaidBy: (o.delivery ?? 0) > 0 ? "client" : "us", primeFee, revenue, cost, profit, marginPct: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
    estimated: lines.some((l) => l.costEstimated),
  };
}

const m = (n: number) => `$${n.toFixed(2)}`;

export function sheetText(s: InternalSheet) {
  const bySupplier = new Map<string, InternalLine[]>();
  for (const l of s.lines) (bySupplier.get(l.supplier) ?? bySupplier.set(l.supplier, []).get(l.supplier)!).push(l);
  const out = [
    `ORDER ${s.orderId} — ${new Date(s.at).toLocaleString("en-GB", { timeZone: "Asia/Beirut" })}`,
    `Customer: ${s.customer} · ${s.phone} · ${s.zone}`,
    `Payment: ${s.payment}`,
    "",
    "TO ORDER FROM SUPPLIERS",
  ];
  for (const [sup, ls] of bySupplier) {
    out.push(`\n${sup}`);
    for (const l of ls) out.push(`  ${l.qty} × ${l.brand} ${l.name} [${l.sku}] — sell ${m(l.unitPrice)}, cost ${m(l.unitCost)}${l.costEstimated ? " (est.)" : ""}, margin ${l.margin}%`);
  }
  out.push(
    "",
    "MONEY",
    `Products sold: ${m(s.goods)}`,
    ...(s.discount ? [`Discounts: −${m(s.discount)}`] : []),
    `Delivery charged to client: ${m(s.deliveryCharged)}${s.deliveryPaidBy === "us" ? " (free delivery — we pay the courier)" : ""}`,
    ...(s.primeFee ? [`SuperPrime membership: ${m(s.primeFee)}`] : []),
    `Revenue: ${m(s.revenue)}`,
    `Product cost: ${m(s.cost - s.courierCost)}${s.estimated ? " (some costs estimated: no supplier price on file)" : ""}`,
    `Courier cost (paid by us): ${m(s.courierCost)}`,
    `PROFIT: ${m(s.profit)} (${s.marginPct}% of revenue)`,
  );
  return out.join("\n");
}

/** After an order: keep the sheet for the admin and email it to the orders inbox. */
export async function sendOrderSheet(o: Order) {
  const s = await buildSheet(o);
  await db.cmd(["SET", `order:internal:${o.id}`, JSON.stringify(s)]);
  const { sendEmail } = await import("@/lib/email");
  const sent = await sendEmail(ORDERS_INBOX, `New order ${o.id} · ${m(o.total)} · profit ${m(s.profit)}`, sheetText(s));
  await db.cmd(["SET", `order:internal:${o.id}:mail`, sent ? "sent" : "not sent (email not set up)"]);
  return { sheet: s, sent };
}

export async function getSheet(id: string): Promise<{ sheet: InternalSheet | null; mail: string | null }> {
  const [raw, mail] = await Promise.all([db.cmd<string | null>(["GET", `order:internal:${id}`]), db.cmd<string | null>(["GET", `order:internal:${id}:mail`])]);
  return { sheet: raw ? (JSON.parse(raw) as InternalSheet) : null, mail };
}
