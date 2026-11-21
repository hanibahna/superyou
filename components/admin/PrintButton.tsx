"use client";

export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return <button onClick={() => window.print()} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">{label}</button>;
}
