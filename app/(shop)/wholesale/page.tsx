import { notFound } from "next/navigation";
import { getGrowth } from "@/lib/growth-store";
import { WholesaleForm } from "./WholesaleForm";

export const metadata = { title: "Wholesale", description: "Pharmacies, salons, clinics, gyms and resellers in Lebanon: buy original beauty, parapharmacy and supplements at wholesale prices from SuperYou." };

export default async function Wholesale() {
  if (!(await getGrowth()).bulk.wholesale) notFound();
  return (
    <div className="container-x max-w-3xl py-10">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-600">SuperYou for business</p>
      <h1 className="mt-1 text-4xl font-bold leading-tight">Wholesale</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">Pharmacies, salons, clinics, gyms, hotels and resellers: buy original beauty, parapharmacy and supplement brands at wholesale prices, delivered across Lebanon.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-3">
        {[["💼", "Business prices", "Tiered prices by volume, quoted for your list."], ["✅", "100% original", "From official Lebanese distributors."], ["🚚", "Delivered", "All over Lebanon, cash or transfer."]].map(([i, t, d]) => (
          <li key={t} className="rounded-2xl bg-[#f6f1f3] p-4"><span className="text-2xl">{i}</span><p className="mt-1 font-semibold">{t}</p><p className="text-sm text-muted">{d}</p></li>
        ))}
      </ul>
      <h2 className="mt-10 text-2xl font-semibold">Tell us about your business</h2>
      <p className="mt-1 text-sm text-muted">Fill in the form and our team will contact you within one working day with prices.</p>
      <WholesaleForm />
    </div>
  );
}
