"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/site-context";
import { money } from "@/lib/format";
import { BookTreatment, type ClinicItem } from "./ClinicView";

/** Part of the SuperRoutine: what to do at the clinic once the home routine is in place, in order. */
export function AfterRoutine({ items, partner = "DermaPro", mock = true }: { items: ClinicItem[]; partner?: string; mock?: boolean }) {
  const t = useT();
  const [book, setBook] = useState<ClinicItem | null>(null);
  if (!items?.length) return null;
  return (
    <section className="mt-8 rounded-2xl border-2 border-[#d13f74]/30 bg-[#fdf6f8] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d13f74]">{t("Step 2 of your SuperRoutine")}</p>
      <h2 className="mt-1 text-xl font-semibold">{t("After your routine: clinic treatments")}</h2>
      <p className="mt-1 text-sm text-muted">{t("Use your home routine for 4–6 weeks first: it prepares your skin. Then these treatments go further than creams can. Our partner dermatologist confirms what suits you.")}</p>
      <p className="mt-2 text-xs"><b>{partner}</b>{mock && <span className="ms-2 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase">{t("Mock-up")}</span>}</p>
      <ol className="mt-4 space-y-3">
        {items.map((i, n) => (
          <li key={i.id} className="rounded-xl bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold">{n + 1}. {t(i.name)}</p>
              <p className="text-sm">{t("from")} <b>{money(i.priceFrom)}</b></p>
            </div>
            <p className="mt-1 text-sm">{t(i.what)}</p>
            <p className="mt-2 text-[13px] text-muted"><b className="text-ink">{t("With your routine:")}</b> {t(i.routine)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button onClick={() => setBook(i)} className="min-h-[40px] rounded-full bg-ink px-4 text-sm font-semibold text-white">{t("Book")}</button>
              <span className="text-xs text-muted">{t(i.sessions)} · {t("Downtime")}: {t(i.downtime)}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] text-muted">{t("Dates are confirmed by our team on WhatsApp. Prices are indicative (mock-up) and confirmed after your consultation.")} <Link href="/clinic/" className="font-semibold underline">{t("All clinic treatments")}</Link></p>
      {book && <BookTreatment item={book} partner={partner} onClose={() => setBook(null)} />}
    </section>
  );
}
