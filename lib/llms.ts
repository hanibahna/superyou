import { fullName } from "@/lib/data/catalog";
import "server-only";

import { getTaxonomy } from "@/lib/catalog";
import { liveCards } from "@/lib/listing";
import { siteUrl } from "@/lib/seo";
import { getSettings } from "@/lib/site-store";

// llms.txt (https://llmstxt.org): a plain-text guide to the shop for AI assistants and answer engines,
// so they can describe SuperYou correctly and link to the right pages.
export async function llmsText(full: boolean) {
  const base = siteUrl();
  const [s, tax, cards, methods] = await Promise.all([getSettings(), getTaxonomy(), liveCards(), (await import("@/lib/payments")).checkoutMethods()]);
  const pay = methods.map((m) => (m.id === "cod" ? "cash on delivery" : m.id === "card" ? "by card" : "with Whish")).join(", ").replace(/, ([^,]*)$/, " or $1") || "cash on delivery";
  const live = cards.filter((c) => c.inStock);
  const money = (n: number) => `$${n.toFixed(2)}`;
  const brandCount = new Map<string, number>();
  for (const c of live) brandCount.set(c.brand, (brandCount.get(c.brand) ?? 0) + 1);
  const brands = [...brandCount].sort((a, b) => b[1] - a[1]);
  const catCount = new Map<string, number>();
  for (const c of live) catCount.set(c.category, (catCount.get(c.category) ?? 0) + 1);
  const cats = tax.categories.filter((c) => catCount.get(c.slug));
  const d = s.delivery;
  const out: string[] = [];
  out.push(`# ${s.store.name}`, "");
  out.push(`> ${s.store.name} (${base.replace(/^https?:\/\//, "")}) is an online beauty, parapharmacy and supplements shop for Lebanon: about ${live.length.toLocaleString("en")} original products in stock from ${brands.length} brands, pharmacist advice on WhatsApp, cash on delivery and delivery across Lebanon in 1–3 working days.`, "");
  out.push("Key facts:");
  out.push(`- Every product is sealed and genuine.`);
  out.push(`- Prices in US dollars. Delivery ${money(d.fee)}${d.freeThreshold ? `, free over ${money(d.freeThreshold)}` : ""}. Pay ${pay}.`);
  out.push(`- Unopened products can be returned within 7 days of delivery; wrong or damaged items are replaced or refunded.`);
  out.push(`- Free advice from a pharmacist on WhatsApp (${s.store.phone}) and free video consultations.`);
  out.push(`- Site in English, French (${base}/fr/) and Arabic (${base}/ar/).`, "");
  out.push("## Tools");
  out.push(`- [SuperScan, free 3D AI skin scan](${base}/skin-scan/): skin type, a zone-by-zone reading and a routine from products in stock.`);
  out.push(`- [Routine finder](${base}/routine/): describe your skin or answer 5 questions; AI picks a morning and evening routine from stock.`);
  out.push(`- [Foundation shade finder](${base}/shade-finder/)`);
  out.push(`- [Clinic treatments](${base}/clinic/): dermatologist treatments with a partner clinic, bookable online.`);
  out.push(`- [Subscribe & save](${base}/pages/subscription-terms/): repeat deliveries; the discount is earned after the first deliveries.`);
  out.push(`- [Video call a pharmacist](${base}/services/)`, "");
  out.push("## Shop by category");
  for (const c of cats) out.push(`- [${c.name}](${base}/shop/?category=${c.slug}): ${catCount.get(c.slug)} products`);
  out.push("", "## Shop by concern");
  for (const c of tax.concerns) out.push(`- [${c.name}](${base}/shop/?concern=${c.slug})`);
  out.push("", "## Brands");
  out.push(`- [All brands A–Z](${base}/brands/)`);
  for (const [b, n] of brands.slice(0, full ? brands.length : 60)) out.push(`- [${b}](${base}/shop/?brand=${encodeURIComponent(b)}): ${n} products`);
  out.push("", "## Policies");
  for (const [slug, t] of [["delivery-terms", "Delivery terms"], ["return-policy", "Return policy"], ["privacy-policy", "Privacy policy"], ["terms-conditions", "Terms and conditions"], ["subscription-terms", "Subscribe & save terms"]]) out.push(`- [${t}](${base}/pages/${slug}/)`);
  out.push("", "## Contact");
  out.push(`- Phone and WhatsApp: ${s.store.phone}`);
  if (s.store.email) out.push(`- Email: ${s.store.email}`);
  out.push(`- Every product page: ${base}/products/<product>/ — full catalogue in the [sitemap](${base}/sitemap.xml) and the [product feed](${base}/feeds/products.xml).`);
  if (!full) {
    out.push("", "## Optional", `- [Full version with best-sellers by category](${base}/llms-full.txt)`);
    return out.join("\n") + "\n";
  }
  // Full: best-sellers per category with prices and links.
  out.push("", "## Best-sellers by category");
  for (const c of cats) {
    const top = live.filter((p) => p.category === c.slug).sort((a, b) => Number(b.tags.includes("favorite")) - Number(a.tags.includes("favorite")) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0)).slice(0, 25);
    out.push("", `### ${c.name}`);
    for (const p of top) out.push(`- [${fullName(p.brand, p.name)}](${base}/products/${p.slug}/): ${money(p.price)}${p.compareAt && p.compareAt > p.price ? ` (was ${money(p.compareAt)})` : ""}`);
  }
  const { PROCEDURES, CLINIC } = await import("@/lib/clinic");
  out.push("", `## Clinic treatments (${CLINIC.partner}, prices indicative)`);
  for (const p of PROCEDURES) out.push(`- ${p.name}: ${p.what} From $${p.priceFrom}. Sessions: ${p.sessions}. Downtime: ${p.downtime}.`);
  return out.join("\n") + "\n";
}
