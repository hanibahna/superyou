import { CLINIC, PROCEDURES, publicProcedure } from "@/lib/clinic";
import { ClinicView } from "./ClinicView";

export async function generateMetadata() {
  return { title: 'Clinic treatments with our partner dermatologist', description: '80 dermatologist treatments with our partner clinic in Beirut: HydraFacial, peels, lasers, microneedling, injectables and more. Prices, sessions and downtime; book online, by WhatsApp or by phone.', ...(await (await import("@/lib/seo")).canonical('/clinic/')) };
}

export default async function ClinicPage() {
  const base = (await import("@/lib/seo")).siteUrl();
  const ld = { "@context": "https://schema.org", "@type": "OfferCatalog", name: `Clinic treatments with ${CLINIC.partner}`, url: `${base}/clinic/`, itemListElement: PROCEDURES.map((p) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: p.name, description: p.what, category: p.category, provider: { "@type": "MedicalClinic", name: CLINIC.partner, address: { "@type": "PostalAddress", addressLocality: "Beirut", addressCountry: "LB" } } }, priceSpecification: { "@type": "PriceSpecification", minPrice: p.priceFrom, priceCurrency: "USD" }, url: `${base}/clinic/?book=${p.id}` })) };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
    <ClinicView partner={CLINIC.partner} mock={CLINIC.mock} note={CLINIC.note} items={PROCEDURES.map(publicProcedure)} />
  </>;
}
