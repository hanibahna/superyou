import { notFound } from "next/navigation";
import { getGrowth } from "@/lib/growth-store";
import { SkinScan } from "./SkinScan";
import { anthropicKey } from "@/lib/extras";

export async function generateMetadata() {
  return { title: 'SuperScan: free 3D AI skin scan', description: 'SuperScan, the free 3D AI skin scan by SuperYou: turn your head in a circle and get your skin type, a zone-by-zone reading and a routine from products in stock.', ...(await (await import("@/lib/seo")).canonical('/skin-scan/')) };
}

const INTRO = "SuperScan is our free 3D AI skin scan, like setting up Face ID: look at the screen, slowly turn your head in a circle, and the AI reads your skin from five angles: front, both sides, chin up and chin down. You get your skin type, a zone-by-zone reading and a routine from products in stock. Photos are analysed once and never stored.";

export default async function SkinScanPage() {
  const g = await getGrowth();
  if (!g.skinScan.enabled) notFound();
  const base = (await import("@/lib/seo")).siteUrl();
  const ld = { "@context": "https://schema.org", "@type": "WebApplication", name: "SuperScan", alternateName: "SuperScan 3D AI skin scan", url: `${base}/skin-scan/`, applicationCategory: "HealthApplication", operatingSystem: "Any (browser with a camera); iPhone with Face ID in the SuperYou app", isAccessibleForFree: true, offers: { "@type": "Offer", price: 0, priceCurrency: "USD" }, description: "A free 3D AI skin scan: turn your head in a circle and get your skin type, a zone-by-zone reading and a morning and evening routine from products in stock. A cosmetic assessment, not a medical diagnosis.", provider: { "@type": "OnlineStore", name: "SuperYou", url: `${base}/` } };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
    <SkinScan intro={/selfie|upload/i.test(g.skinScan.intro) ? INTRO : g.skinScan.intro} ready={!!(await anthropicKey())} />
  </>;
}
