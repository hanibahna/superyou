import Link from "next/link";
import { notFound } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { getScan } from "@/lib/scans";
import { ScanResultView } from "./ScanResultView";

export const metadata = { title: "My SuperScan", robots: { index: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const s = await getScan((await params).id);
  const t = (await searchParams).t ?? "";
  if (!s || t.length !== s.token.length || !timingSafeEqual(Buffer.from(t), Buffer.from(s.token))) notFound();
  return (
    <div className="container-x max-w-4xl py-10">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-600">SuperScan · 3D AI skin scan</p>
      <h1 className="mt-1 text-3xl font-bold">{s.name ? `${s.name.split(" ")[0]}'s skin` : "Your skin"} · {new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</h1>
      <ScanResultView scan={{ analysis: s.analysis, steps: s.steps }} />
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/skin-scan/?from=${s.id}&t=${s.token}`} className="scan-glow inline-flex min-h-[48px] items-center rounded-full px-6 font-semibold text-white">Rescan and compare</Link>
        <Link href="/services/?book=video-consult" className="inline-flex min-h-[48px] items-center rounded-full border border-line px-6 font-semibold">Ask a pharmacist</Link>
      </div>
      <p className="mt-6 text-xs text-muted">Cosmetic AI assessment from SuperScan (3D AI skin scan), not a medical diagnosis. The photos were not stored.</p>
    </div>
  );
}
