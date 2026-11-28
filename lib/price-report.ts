import "server-only";

// Internal price comparison report (emailed to the owners, never shown to customers, so the
// shops we buy from, NeoVitale included, are named here). Built from the competitor price
// database that every price check keeps (lib/price-match.ts): only prices seen in the last 2 days.
import { db } from "@/lib/db";
import { getGrowth } from "@/lib/growth-store";
import { liveProducts } from "@/lib/pricing";
import { getMargins, floorPrice } from "@/lib/margins";
import { REPORT_TO } from "@/lib/neo-sync";
import { sendEmail } from "@/lib/email";
import type { Rec } from "@/lib/price-match";

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (a: unknown[]) => a.map(csvCell).join(",");
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function buildComparison() {
  const sites = (await getGrowth()).priceMatch.sites.filter((s) => s.enabled);
  const fresh = Date.now() - 2 * 86400_000;
  // productId → { shop label → Rec }
  const at = new Map<string, Map<string, Rec>>();
  for (const s of sites) {
    let cursor = "0";
    do {
      const [next, flat] = (await db.cmd<[string, string[]]>(["HSCAN", `pm:db:${s.domain}`, cursor, "COUNT", 3000])) ?? ["0", []];
      for (let i = 0; i < flat.length; i += 2) {
        try {
          const r = JSON.parse(flat[i + 1]) as Rec;
          if (Date.parse(r.seen) < fresh) continue;
          (at.get(flat[i]) ?? at.set(flat[i], new Map()).get(flat[i])!).set(s.label, r);
        } catch { /* skip */ }
      }
      cursor = String(next);
    } while (cursor !== "0");
  }
  const live = await liveProducts();
  const margins = await getMargins();
  const neo = sites.find((s) => /neovitale/i.test(s.domain))?.label ?? "NeoVitale";
  const labels = sites.map((s) => s.label);
  const head = ["Product ID", "Brand", "Product", "Size / shade", "Category", "Our price now", "Our regular price", "On sale", "Our cost", "Our margin %", "Lowest we can go (min. margin)", "SuperPrice / claim", `${neo} price`, "Cheapest other shop", "Its price", "Ours vs cheapest %", "Shops that have it", ...labels];
  const lines = [row(head)];
  const per = new Map<string, { n: number; cheaper: number; same: number; dearer: number; ratios: number[] }>();
  let withData = 0, weCheapest = 0, cheaperElsewhere = 0;
  for (const p of live.list) {
    const shops = at.get(p.id);
    if (!shops?.size) continue;
    withData++;
    const x = p as typeof p & { matchWas?: number; cmpVs?: number; pmLose?: boolean };
    const regular = x.matchWas ?? (p.compareAt && p.compareAt > p.price ? p.compareAt : p.price);
    const others = [...shops].filter(([l]) => l !== neo).sort((a, b) => a[1].p - b[1].p);
    const best = others[0];
    if (best && best[1].p < p.price - 0.005) cheaperElsewhere++; else weCheapest++;
    for (const [l, r] of shops) {
      const s = per.get(l) ?? per.set(l, { n: 0, cheaper: 0, same: 0, dearer: 0, ratios: [] }).get(l)!;
      s.n++;
      s.ratios.push(r.p / p.price);
      if (r.p < p.price * 0.995) s.cheaper++; else if (r.p > p.price * 1.005) s.dearer++; else s.same++;
    }
    const floor = floorPrice(p, margins);
    lines.push(row([
      p.id, p.brand, p.name, p.variant ?? p.size ?? "", p.category, r2(p.price), r2(regular), p.price < regular - 0.005 ? "yes" : "",
      p.cost ? r2(p.cost) : "", p.cost ? Math.round(((p.price - p.cost) / p.price) * 1000) / 10 : "", floor !== undefined ? r2(floor) : "",
      x.matchWas ? "SuperPrice" : x.cmpVs ? "Lowest listed" : x.pmLose ? "Hidden (cheaper elsewhere)" : "",
      shops.get(neo)?.p ?? "", best?.[0] ?? "", best ? r2(best[1].p) : "", best ? Math.round(((p.price - best[1].p) / best[1].p) * 1000) / 10 : "", shops.size,
      ...labels.map((l) => (shops.get(l) ? r2(shops.get(l)!.p) : "")),
    ]));
  }
  const shopLines = [row(["Shop", "Products in common", "Cheaper than us", "Same price", "Dearer than us", "Median their price ÷ ours", "Typical gap"])];
  for (const l of labels) {
    const s = per.get(l);
    if (!s) { shopLines.push(row([l, 0, "", "", "", "", "not read or nothing in common"])); continue; }
    const m = s.ratios.sort((a, b) => a - b)[Math.floor(s.ratios.length / 2)];
    shopLines.push(row([l, s.n, s.cheaper, s.same, s.dearer, Math.round(m * 1000) / 1000, m < 1 ? `${Math.round((1 - m) * 100)}% cheaper` : `${Math.round((m - 1) * 100)}% dearer`]));
  }
  return { products: lines.join("\n"), shops: shopLines.join("\n"), summary: { visible: live.list.length, withData, weCheapest, cheaperElsewhere, shops: sites.length } };
}

export async function emailComparison() {
  const r = await buildComparison();
  const day = new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Beirut" }).replace(/\//g, "-");
  const s = r.summary;
  const text = `SuperYou price comparison, ${day}

Products on sale on the site: ${s.visible.toLocaleString()}
Found at one or more shops (incl. NeoVitale): ${s.withData.toLocaleString()}
  We are the cheapest (or same price): ${s.weCheapest.toLocaleString()}
  At least one shop is cheaper (excl. NeoVitale): ${s.cheaperElsewhere.toLocaleString()}
Shops compared: ${s.shops}

Attached:
- price-comparison-products: one row per product, our price, cost, margin, the lowest we can go, NeoVitale's price, the cheapest other shop, and a column per shop.
- price-comparison-shops: per shop, products in common and how often they are cheaper or dearer.

Prices are the shelf prices each shop lists (their promo codes and delivery fees not included), from price checks of the last 2 days.`;
  const att = [
    { filename: `price-comparison-products-${day}.csv`, content: Buffer.from("﻿" + r.products, "utf8").toString("base64") },
    { filename: `price-comparison-shops-${day}.csv`, content: Buffer.from("﻿" + r.shops, "utf8").toString("base64") },
  ];
  const sent: boolean[] = [];
  for (const to of REPORT_TO) sent.push(await sendEmail(to, `SuperYou price comparison ${day}`, text, att).catch(() => false));
  return { sent, summary: s, bytes: r.products.length };
}
