"use client";

import Link from "next/link";
import { money } from "@/lib/format";
import type { SavedScan } from "@/lib/scans";

export function ScanResultView({ scan }: { scan: Pick<SavedScan, "analysis" | "steps"> }) {
  const a = scan.analysis;
  return (
    <>
      <div className="mt-6 rounded-2xl border border-line p-5">
        <p className="text-2xl font-bold">{a.skinType} skin{a.sensitive ? ", easily irritated" : ""}</p>
        {a.concerns.length > 0 && <p className="mt-1 text-sm">Focus: {a.concerns.join(" · ")}</p>}
        <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-muted">{a.observations.map((o) => <li key={o}>{o}</li>)}</ul>
        {!!a.zones?.length && <div className="mt-4 grid gap-2 sm:grid-cols-2">{a.zones.map((z) => <p key={z.zone} className="rounded-xl bg-[#f6f1f3] px-3 py-2 text-sm"><b className="capitalize">{z.zone}</b>: {z.note}</p>)}</div>}
      </div>
      <h2 className="mt-8 text-xl font-semibold">Your routine</h2>
      <ol className="mt-3 space-y-3">
        {scan.steps.map((s, i) => (
          <li key={s.name + i} className="rounded-2xl bg-[#f6f1f3] p-4">
            <p className="font-semibold">{i + 1}. {s.name} <span className="text-xs font-normal uppercase text-muted">{s.time === "both" ? "AM + PM" : s.time}</span></p>
            <p className="text-sm text-muted">{s.tip}</p>
            {s.product && <Link href={`/products/${s.product.slug}/`} className="mt-2 inline-block font-semibold underline">{s.product.brand} {s.product.name} · {money(s.product.price)}</Link>}
          </li>
        ))}
      </ol>
    </>
  );
}
