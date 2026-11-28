import "server-only";
import { getIndex } from "@/lib/catalog";
import { liveProducts } from "@/lib/pricing";
import { getMargins, floorPrice } from "@/lib/margins";
import { getPromotions } from "@/lib/site-store";
import { inScope, isLive, salePrice } from "@/lib/site";
import { discountStatus } from "@/lib/discount-status";
import { roomRows } from "@/lib/pricing-room";
import { REPORT_TO } from "@/lib/neo-sync";
import { sendEmail } from "@/lib/email";

const csv = (rows: (string | number)[][]) => rows.map((r) => r.map((c) => { const s = String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
const b64 = (s: string) => Buffer.from("﻿" + s, "utf8").toString("base64");

/** Pricing check emailed to the report addresses: discount rules, capped products, brands without a cost. */
export async function emailPricingCheck() {
  const [st, { rows }, live, idx, m, promos] = await Promise.all([discountStatus(), roomRows(), liveProducts(), getIndex(), getMargins(), getPromotions()]);
  const auto = promos.paused ? [] : promos.discounts.filter((d) => !d.code && d.minSubtotal === 0 && isLive(d));
  const capped: (string | number)[][] = [];
  for (const lp of live.list) {
    const p = idx.byId.get(lp.id); if (!p || !(p.price > 0)) continue;
    const s = salePrice(p, auto); const f = floorPrice(p, m);
    if (s.rule && f !== undefined && s.price < f - 0.005) capped.push([p.brand, p.name + (p.variant ? ` ${p.variant}` : ""), p.sku, p.price.toFixed(2), s.rule.name, s.rule.value + "%", f.toFixed(2), Math.max(0, Math.round((1 - f / p.price) * 100)) + "%"]);
  }
  capped.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
  const live2 = rows.filter((r) => r.inStock > 0);
  const noCost = live2.filter((r) => r.room == null).sort((a, b) => b.inStock - a.inStock);
  const below = live2.filter((r) => r.marginPct != null && r.marginPct < r.floorPct);
  const on = (b: string) => auto.some((d) => inScope({ brand: b, category: "", concerns: [], tags: [], sku: "" }, d.scope) && !(d.exclude.kind === "brand" && d.exclude.values.some((v) => v.toLowerCase() === b.toLowerCase())));

  const L: string[] = [];
  L.push("SuperYou pricing check", `${new Date().toLocaleString("en-GB", { timeZone: "Asia/Beirut" })} (Beirut)`, "");
  L.push("Catalog in the shop: NeoVitale only (Skin Society, feel22, myholdal and beautyjoint are hidden).");
  L.push(`Products for sale: ${st.products.toLocaleString()} · on sale now: ${st.onSale.toLocaleString()} · capped by the minimum margin: ${st.cappedTotal}`);
  L.push(`All discounts & codes: ${st.paused ? "OFF" : "ON"} · minimum margin: ${st.floorPct}% store-wide`, "");
  L.push("1. DISCOUNT RULES", "");
  st.rules.forEach((r, i) => {
    L.push(`${i + 1}) ${r.name} — ${r.kind}, ${r.state}, ${r.value} off`);
    L.push(`   Applies to: ${r.scope}`);
    L.push(`   Exceptions: ${r.exceptions}`);
    L.push(`   Covers ${r.covers.toLocaleString()} products · used on ${r.kind === "Automatic sale" || r.kind === "Black Friday" ? r.wins.toLocaleString() : "at checkout"}`);
    L.push(`   Check: ${r.warnings.length ? r.warnings.join("; ") : "OK"}`, "");
  });
  L.push("Fixed today: the 10% sale only excluded Essence and Garnier, so Kérastase, Optimal, Philips Avent and Samoa were getting 10%. Now it excludes all six; Samoa has its own 5%; the empty rule was deleted.", "");
  L.push(`2. PRODUCTS CAPPED BY THE MINIMUM MARGIN (${capped.length}) — full list attached (capped-products.csv)`, "");
  const byBrand = new Map<string, number>(); for (const c of capped) byBrand.set(String(c[0]), (byBrand.get(String(c[0])) ?? 0) + 1);
  [...byBrand].sort((a, b) => b[1] - a[1]).forEach(([b, n], i) => L.push(`${i + 1}) ${b}: ${n} product${n === 1 ? "" : "s"}`));
  L.push("");
  L.push(`3. BRANDS WITH NO COST ON FILE (${noCost.length}) — the minimum margin can't protect these; full list attached (brands-no-cost.csv)`, "");
  noCost.forEach((r, i) => L.push(`${i + 1}) ${r.brand} — ${r.inStock} in stock${on(r.brand) ? " · in the 10% sale" : ""}`));
  L.push("");
  L.push(`4. BRANDS BELOW THE MINIMUM MARGIN BEFORE ANY DISCOUNT (${below.length})`, "");
  below.forEach((r, i) => L.push(`${i + 1}) ${r.brand} — margin ${r.marginPct}%, floor ${r.floorPct}%, ${r.inStock} in stock`));
  if (!below.length) L.push("None.");
  L.push("");
  L.push("5. BLACK FRIDAY", "", "No per-brand Black Friday prices are set. The −10% shoppers see comes from the 10% sale.", "");
  L.push("What to do: add the missing brand rates in Admin → Pricing → Margins & costs, or leave brands without a cost out of the sale until their costs are in.");

  const attachments = [
    { filename: "capped-products.csv", content: b64(csv([["Brand", "Product", "SKU", "Regular price", "Sale", "Sale %", "Minimum-margin price", "Customer gets"], ...capped])) },
    { filename: "brands-no-cost.csv", content: b64(csv([["Brand", "In stock", "Products", "In 10% sale"], ...noCost.map((r) => [r.brand, r.inStock, r.products, on(r.brand) ? "yes" : "no"])])) },
  ];
  const sent: boolean[] = [];
  for (const to of REPORT_TO) sent.push(await sendEmail(to, `SuperYou pricing check — ${noCost.length} brands without cost, ${capped.length} capped`, L.join("\n"), attachments).catch(() => false));
  return { sent, to: REPORT_TO, capped: capped.length, noCost: noCost.length, below: below.length };
}
